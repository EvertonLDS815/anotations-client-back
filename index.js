const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// ✅ CORS liberado (depois você restringe)
app.use(cors());
app.use(express.json());

// ✅ conexão reutilizável (IMPORTANTE PRA VERCEL)
let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  try {
    const db = await mongoose.connect(process.env.MONGODB_URI);

    isConnected = db.connections[0].readyState === 1;

    console.log("🚀 MongoDB conectado!");
  } catch (err) {
    console.error("🔴 Erro ao conectar no MongoDB:", err);
    throw err;
  }
}

// =======================
// 📦 SCHEMA
// =======================
const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  valueTotal: { type: Number, required: true },
  desconto: { type: Number, required: true },
  dataDaCompra: { type: Date, default: Date.now },

  parcelas: [
    {
      valor: { type: Number, required: true },
      valorPago: { type: Number, default: 0 },
      dataDeVencimento: { type: Date, required: true },
      dataDePagamento: { type: Date, default: null },

      status: {
        type: String,
        enum: ['late', 'pending', 'paid'],
        default: 'pending'
      }
    },
  ],

  createdAt: { type: Date, default: Date.now },
});

const Client = mongoose.models.Client || mongoose.model('Client', clientSchema);

// =======================
// 🧠 FUNÇÕES
// =======================
function calcularStatusParcela(dataDeVencimento) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const vencimento = new Date(dataDeVencimento);
  vencimento.setHours(0, 0, 0, 0);

  return vencimento < hoje ? "late" : "pending";
}

// =======================
// 📌 ROTAS
// =======================

// 🔎 GET ALL
app.get('/clients', async (req, res) => {
  try {
    await connectDB();

    const clients = await Client.find();

    const hoje = new Date().toISOString().split("T")[0];

    const clientsAtualizados = clients.map(client => ({
      ...client.toObject(),
      parcelas: client.parcelas.map(parcela => {

        if (parcela.status === "paid") return parcela;

        const status =
          hoje >= parcela.dataDeVencimento
            ? "late"
            : "pending";

        return {
          ...parcela.toObject(),
          status
        };
      })
    }));

    res.status(200).json(clientsAtualizados);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ➕ CREATE
app.post('/client', async (req, res) => {
  try {
    await connectDB();

    const { name, valueTotal, desconto = 0, parcelas } = req.body;

    if (!name || !valueTotal || !parcelas || !Array.isArray(parcelas)) {
      return res.status(400).json({ error: "Dados obrigatórios inválidos" });
    }

    const somaParcelas = parcelas.reduce((acc, p) => acc + Number(p.valor || 0), 0);

    if (somaParcelas !== valueTotal) {
      return res.status(400).json({
        error: "A soma das parcelas deve ser igual ao valor total"
      });
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const parcelasFormatadas = parcelas.map((p, index) => {
      if (!p.valor || !p.dataDeVencimento) {
        throw new Error(`Parcela ${index + 1} inválida`);
      }

      const vencimento = new Date(p.dataDeVencimento);
      vencimento.setHours(0, 0, 0, 0);

      let status = "pending";

      if (p.dataDePagamento) {
        status = "paid";
      } else if (vencimento < hoje) {
        status = "late";
      }

      return {
        numero: index + 1,
        valor: Number(p.valor),
        dataDeVencimento: vencimento,
        dataDePagamento: p.dataDePagamento ? new Date(p.dataDePagamento) : null,
        status
      };
    });

    const client = await Client.create({
      name,
      valueTotal,
      desconto,
      parcelas: parcelasFormatadas
    });

    res.status(201).json(client);

  } catch (err) {
    console.log("ERRO DETALHADO:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🔎 GET ONE
app.get('/client/:id', async (req, res) => {
  try {
    await connectDB();

    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    res.status(200).json(client);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✏️ UPDATE PARCELA
app.put('/client/:clientId/parcela/:parcelaId', async (req, res) => {
  try {
    await connectDB();

    const { clientId, parcelaId } = req.params;
    const { valorPago } = req.body;

    const client = await Client.findOne({
      _id: clientId,
      "parcelas._id": parcelaId
    });

    if (!client) {
      return res.status(404).json({ error: "Cliente ou parcela não encontrada" });
    }

    const parcela = client.parcelas.id(parcelaId);

    let novoStatus;
    let dataDePagamento = parcela.dataDePagamento;

    if (valorPago === 0) {
      parcela.valorPago = 0;
      dataDePagamento = null;
      novoStatus = calcularStatusParcela(parcela.dataDeVencimento);
    }

    else if (valorPago > 0) {
      parcela.valorPago += Number(valorPago);

      if (parcela.valorPago > parcela.valor) {
        parcela.valorPago = parcela.valor;
      }

      if (parcela.valorPago >= parcela.valor) {
        novoStatus = "paid";
        dataDePagamento = new Date();
      } else {
        novoStatus = calcularStatusParcela(parcela.dataDeVencimento);
      }
    }

    else {
      if (parcela.dataDePagamento) {
        parcela.valorPago = 0;
        dataDePagamento = null;
        novoStatus = calcularStatusParcela(parcela.dataDeVencimento);
      } else {
        parcela.valorPago = parcela.valor;
        dataDePagamento = new Date();
        novoStatus = "paid";
      }
    }

    const clientAtualizado = await Client.findOneAndUpdate(
      { _id: clientId, "parcelas._id": parcelaId },
      {
        $set: {
          "parcelas.$.status": novoStatus,
          "parcelas.$.dataDePagamento": dataDePagamento,
          "parcelas.$.valorPago": parcela.valorPago
        }
      },
      { new: true }
    );

    const parcelaAtualizada = clientAtualizado.parcelas.id(parcelaId);

    res.status(200).json({
      message: "Parcela atualizada",
      parcelaAtualizada
    });

  } catch (err) {
    console.error("ERRO DETALHADO:", err);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// 🔥 EXPORTAÇÃO (VERCEL)
// =======================
module.exports = app;