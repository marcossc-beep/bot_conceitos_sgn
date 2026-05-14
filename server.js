import Fastify from 'fastify';
import cors from '@fastify/cors';
import 'dotenv/config';
import crypto from 'crypto'; // Para gerar IDs únicos (nativa do Node)
import fs from 'node:fs/promises'; // Importa a versão de promessas do fs
import path from 'node:path';

// Importamos o orquestrador
import { runConceitosAutomation } from './etapas/orquestrador_conceitos.js';

const fastify = Fastify({ logger: true });
await fastify.register(cors, { origin: '*' });

// 🧠 NOSSO GERENCIADOR DE ESTADO (Em memória)
const jobs = {};

// Endpoint 1: Inicia a automação em background e devolve o Ticket (jobId)
fastify.post('/start-automation', async (request, reply) => {
  const { user, password, diaryLink, avSelection, jsonData } = request.body;
  
  // Gera um "Ticket" único para essa execução
  const jobId = crypto.randomUUID();

  // Registra o status inicial
  jobs[jobId] = {
    status: 'running', // Pode ser 'running', 'completed' ou 'error'
    logs: [],
    result: null
  };

  // Essa função será passada para o Orquestrador injetar os logs aqui em tempo real
  const addLog = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    jobs[jobId].logs.push(`[${timestamp}] ${msg}`);
  };

  // 🔥 MAGIA AQUI: Rodamos o orquestrador SEM o "await" antes.
  // Isso faz a promessa rodar em background sem travar a resposta do servidor.
  runConceitosAutomation({ user, password, diaryLink, avSelection, jsonData, addLog })
    .then(result => {
      jobs[jobId].status = result.success ? 'completed' : 'error';
      jobs[jobId].result = result;
    })
    .catch(error => {
      jobs[jobId].status = 'error';
      jobs[jobId].logs.push(`[${new Date().toLocaleTimeString()}] 🛑 ERRO FATAL: ${error.message}`);
    });

  // Responde imediatamente ao Frontend com o Ticket
  return reply.send({ 
    success: true, 
    jobId, 
    message: 'Automação iniciada em background!' 
  });
});

// Endpoint 2: Consulta o status e os logs do Ticket
fastify.get('/status/:jobId', async (request, reply) => {
  const { jobId } = request.params;
  const job = jobs[jobId];

  if (!job) {
    return reply.status(404).send({ success: false, message: 'Job não encontrado.' });
  }

  return reply.send({
    success: true,
    status: job.status,
    logs: job.logs
  });
});

// Rota para buscar as turmas
fastify.get('/turmas', async (request, reply) => {
    try {
        const data = await fs.readFile(path.join(process.cwd(), 'data', 'turmas.json'), 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return reply.status(500).send({ error: 'Erro ao ler turmas.json' });
    }
});

// Rota para buscar as UCs e seus links
fastify.get('/ucs', async (request, reply) => {
    try {
        const data = await fs.readFile(path.join(process.cwd(), 'data', 'ucs.json'), 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return reply.status(500).send({ error: 'Erro ao ler ucs.json' });
    }
});

// Rota para servir o frontend (index.html) na raiz
fastify.get('/', async (request, reply) => {
  try {
    const html = await fs.readFile(path.join(process.cwd(), 'index.html'), 'utf8');
    return reply.type('text/html').send(html);
  } catch (err) {
    return reply.status(500).send({ error: 'Erro ao carregar o index.html' });
  }
});

const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Servidor rodando em: http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();