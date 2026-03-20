const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { compileMultiLine, setInputHandler, resetInputState } = require('./compiler-engine');

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

const pendingInputResolvers = new Map();
let compileQueue = Promise.resolve();

function enqueueCompileTask(task) {
  const queued = compileQueue.then(task, task);
  compileQueue = queued.catch(() => undefined);
  return queued;
}

function createAbortError(message) {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function resetSocketInputState(socket, message = 'Compilation reset - input cancelled', notifyClient = false) {
  for (const [requestId, pendingRequest] of pendingInputResolvers.entries()) {
    if (pendingRequest.socketId !== socket.id) continue;
    pendingRequest.reject(createAbortError(message));
    pendingInputResolvers.delete(requestId);
  }

  if (notifyClient) {
    socket.emit('reset-input', { message });
  }
}

function createInteractiveInputHandler(socket, runtimeInput) {
  return async (identifier, requestId) => {
    if (Object.prototype.hasOwnProperty.call(runtimeInput, identifier)) {
      return runtimeInput[identifier];
    }

    return new Promise((resolve, reject) => {
      const resolvedRequestId =
        typeof requestId === 'string' && requestId.length > 0
          ? requestId
          : `${identifier}:${Date.now()}:${Math.random()}`;

      pendingInputResolvers.set(resolvedRequestId, {
        socketId: socket.id,
        name: identifier,
        resolve,
        reject,
      });

      socket.emit('request-input', { name: identifier, requestId: resolvedRequestId });
    });
  };
}

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/compile', async (req, res) => {
  const { code, input } = req.body || {};

  if (typeof code !== 'string') {
    return res.status(400).json({
      message: 'Invalid request body. Expected: { code: string }',
    });
  }

  if (input !== undefined && (typeof input !== 'object' || input === null || Array.isArray(input))) {
    return res.status(400).json({
      message: 'Invalid request body. Expected optional input as an object map: { code: string, input?: Record<string,string|number|boolean> }',
    });
  }

  const runtimeInput = input || {};

  try {
    const result = await enqueueCompileTask(async () => {
      resetInputState();
      setInputHandler(async (identifier) => {
        if (Object.prototype.hasOwnProperty.call(runtimeInput, identifier)) {
          return runtimeInput[identifier];
        }
        throw new Error(`No input provided for '${identifier}'. Add it in Program Input as ${identifier}=value`);
      });
      return compileMultiLine(code, runtimeInput);
    });

    return res.json(result);
  } catch (error) {
    return res.status(400).json({
      message: error?.message || 'Compilation failed',
    });
  }
});

io.on('connection', (socket) => {
  socket.on('compile', (payload = {}) => {
    const code = typeof payload.code === 'string' ? payload.code : '';
    const input = payload.input;

    if (!code) {
      socket.emit('compile-error', { message: 'Invalid request body. Expected: { code: string }' });
      return;
    }

    if (input !== undefined && (typeof input !== 'object' || input === null || Array.isArray(input))) {
      socket.emit('compile-error', {
        message: 'Invalid compile payload. Expected optional input object map.',
      });
      return;
    }

    const runtimeInput = input || {};
    resetSocketInputState(socket, 'Compilation reset - input cancelled', true);
    resetInputState();

    void enqueueCompileTask(async () => {
      try {
        setInputHandler(createInteractiveInputHandler(socket, runtimeInput));
        const result = await compileMultiLine(code, runtimeInput);
        socket.emit('compile-result', result);
      } catch (error) {
        socket.emit('compile-error', { message: error?.message || 'Compilation failed' });
      } finally {
        resetSocketInputState(socket, 'Compilation finished', false);
      }
    });
  });

  socket.on('submit-input', (payload = {}) => {
    const requestId = typeof payload.requestId === 'string' ? payload.requestId : '';
    const name = typeof payload.name === 'string' ? payload.name : '';
    const value = payload.value;

    if (!name && !requestId) {
      socket.emit('compile-error', { message: 'Invalid input payload. Expected: { name, value }' });
      return;
    }

    let resolverEntry;
    let resolverKey = requestId;

    if (requestId) {
      resolverEntry = pendingInputResolvers.get(requestId);
    }

    if (!resolverEntry && name) {
      for (const [key, pendingRequest] of pendingInputResolvers.entries()) {
        if (pendingRequest.socketId === socket.id && pendingRequest.name === name) {
          resolverEntry = pendingRequest;
          resolverKey = key;
          break;
        }
      }
    }

    if (!resolverEntry || resolverEntry.socketId !== socket.id) {
      socket.emit('compile-error', { message: `No pending input request for '${name || requestId}'.` });
      return;
    }

    pendingInputResolvers.delete(resolverKey);
    resolverEntry.resolve(value);
  });

  socket.on('disconnect', () => {
    resetSocketInputState(socket, 'Input stream closed while waiting for value', false);
  });
});

server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
