const express = require('express');
const app = express();
const port = 3000;
const dotenv = require('dotenv');
const mongoose = require('mongoose');
dotenv.config();

const cors = require('cors');
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://anotations-client-back.vercel.app/'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());


const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  valueTotal: { type: Number, required: true },
  desconto: { type: Number, required: true },
  dataDaCompra: { type: Date, default: Date.now },

  parcelas: [
    {
      valor: { type: Number, required: true },

      valorPago: { type: Number, default: 0 }, // 👈 ADICIONE ISSO

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

const Client = mongoose.model('Client', clientSchema);

// conectar ao MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('🚀 MongoDB connected!'))
  .catch(err => console.error('🔴 MongoDB connection error:', err));

  function calcularStatusParcela(dataDeVencimento) {
  const hoje = new Date();
  const hojeSemHora = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate()
  );

  const vencimento = new Date(dataDeVencimento);
  const vencimentoSemHora = new Date(
    vencimento.getFullYear(),
    vencimento.getMonth(),
    vencimento.getDate()
  );

  if (vencimentoSemHora < hojeSemHora) {
    return "late";
  } else {
    return "pending";
  }
}


app.get('/clients', async (req, res) => {
  try {
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

    return res.status(200).json(clientsAtualizados);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/client", async (req, res) => {
  try {
    const { name, valueTotal, desconto = 0, parcelas } = req.body;

    if (!name || !valueTotal || !parcelas || !Array.isArray(parcelas)) {
      return res.status(400).json({ error: "Dados obrigatórios inválidos" });
    }

    // 🧠 validar soma das parcelas
    const somaParcelas = parcelas.reduce((acc, p) => acc + Number(p.valor || 0), 0);

    if (somaParcelas !== valueTotal) {
      return res.status(400).json({
        error: "A soma das parcelas deve ser igual ao valor total"
      });
    }

    // 🧠 data de hoje (sem hora)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // 🔄 formatar parcelas
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

    // 💾 salvar no banco
    const client = await Client.create({
      name,
      valueTotal,
      desconto,
      parcelas: parcelasFormatadas
      // dataDaCompra automático
    });

    res.status(201).json(client);

  } catch (err) {
    console.log("ERRO DETALHADO:", err);
    res.status(500).json({ error: err.message });
  }
});

// Pegar apenas um cliente específico
app.get('/client/:id', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    return res.status(200).json(client);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Lembrando que o id é o id do cliente e a parcela é o número do array de objetos se for a primeira parcela você mandaria o 0 e o segundo seria o 1 e assim por diante
app.put('/client/:clientId/parcela/:parcelaId', async (req, res) => {
  try {
    const { clientId, parcelaId } = req.params;
    const { valorPago } = req.body; // 👈 novo

    const client = await Client.findOne({
      _id: clientId,
      "parcelas._id": parcelaId
    });

    if (!client) {
      return res.status(404).json({ error: "Cliente ou parcela não encontrada" });
    }

    const parcela = client.parcelas.id(parcelaId);

    if (!parcela) {
      return res.status(404).json({ error: "Parcela não encontrada" });
    }

    let novoStatus;
    let dataDePagamento = parcela.dataDePagamento;

    // 🔁 DESMARCAR (zera tudo)
    if (valorPago === 0) {
      parcela.valorPago = 0;
      dataDePagamento = null;
      novoStatus = calcularStatusParcela(parcela.dataDeVencimento);
    }

    // 💰 PAGAMENTO (parcial ou total)
    else if (valorPago > 0) {
      parcela.valorPago += Number(valorPago);

      // 🔒 evita ultrapassar
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

    // 🔁 fallback (clicar sem valor → comportamento antigo)
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

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://10.0.0.110:${port}`);
});