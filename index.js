import express, { json } from "express";
import cors from "cors";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";
import { MongoClient } from "mongodb";

// COLEÇÕES: "nomes" e "mensagens";

dotenv.config();
const PORT = process.env.PORT;

const cliente = new MongoClient(process.env.URL_CONNECT_MONGO);
let db;

cliente.connect().then(() => {
  db = cliente.db("Api-Uol");
});

const server = express();

server.use(cors());
server.use(json());

const nomeSchema = joi.object({ name: joi.string().required().min(1) });
const mensagemSchema = joi.object({
  to: joi.string().required().min(1),
  text: joi.string().required().min(1),
  type: joi.string().required().valid("message", "private_message"),
});

server.post("/participants", async (req, res) => {
  const { name } = req.body;

  const validation = nomeSchema.validate(req.body, { abortEarly: false });
  if (validation.error) {
    const erros = validation.error.details.map((detail) => detail.message);
    res.status(422).send(erros);
    return;
  }

  try {
    const nomeJaExiste = await db.collection("nomes").findOne({ name: name });
    if (nomeJaExiste) {
      res.status(409).send("Usuario já existe!");
      return;
    }
    await db
      .collection("nomes")
      .insertOne({ name: name, lastStatus: Date.now() });
    await db.collection("mensagens").insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:MM:SS"),
    });

    res.sendStatus(201);
  } catch (error) {
    res.sendStatus(400);
    return;
  }
});

server.get("/participants", async (req, res) => {
  try {
    const usuarios = await db.collection("nomes").find().toArray();
    res.send(usuarios);
  } catch (error) {
    res.sendStatus(400);
    return;
  }
});

server.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const { user } = req.headers; //from;

  const validation = mensagemSchema.validate(req.body, { abortEarly: false });
  if (validation.error) {
    const erros = validation.error.details.map((detail) => detail.message);
    res.status(422).send(erros);
    return;
  }

  try {
    const nomeJaExiste = await db.collection("nomes").findOne({ name: user });
    if (!nomeJaExiste) {
      res.sendStatus(422);
      return;
    }

    await db.collection("mensagens").insertOne({
      from: user,
      to,
      text,
      type,
      time: dayjs().format("HH:MM:SS"),
    });

    res.sendStatus(201);
  } catch (error) {
    res.sendStatus(422);
  }
});

server.get("/messages", async (req, res) => {
  const limit = Number(req.query.limit); // não desestruturei pq precisava se chamar limit
  const { user } = req.headers;
  const { to, from, type } = req.body;



  try {
    const mensagens = await db.collection("mensagens").find().toArray();
    const mensagensFiltradas = mensagens.filter(
      (mensagem) =>
        mensagem.to === user || 
        mensagem.from === user ||
        mensagem.to === "Todos"
        
    );

    if (limit) {
      res.send(mensagensFiltradas.slice(-limit));
    } else {
      res.send(mensagensFiltradas);
    }
  } catch (error) {
    res.sendStatus(400);
    return;
  }
});

server.post("/status", async (req, res) => {
  const { user } = req.headers;

  try {
    const nomeJaExiste = await db.collection("nomes").findOne({ name: user });

    if (!nomeJaExiste) {
      res.sendStatus(404);
      return;
    }

    await db
      .collection("nomes")
      .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    res.sendStatus(200);
  } catch (error) {
    res.sendStatus(400);
  }
});

setInterval(async () => {
  
  
    const inativos = await db.collection("nomes").find().toArray();
  const filtrados = inativos.filter(filtrar => ((Date.now() - filtrar.lastStatus)/1000) > 10)

  filtrados.map(filtrado => {
      db.collection("mensagens").insertOne({
        from: filtrado.name,
          to: "Todos",
          text: "sai da sala...",
         type: "status",
         time: dayjs().format("HH:MM:SS")
      });
     db.collection("nomes").deleteOne({
        name: filtrado.name
      });
    }) 

  
}, 15000);

server.listen(PORT, () => {
  console.log(`Servidor funcionando!`);
});