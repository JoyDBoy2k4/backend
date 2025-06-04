const express = require("express");
const fs = require("fs").promises;
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: '*' })); // Restrict origin in production
app.use(express.json());

// Serve static product images
app.use("/assets", express.static(path.join(__dirname, "assets")));

// File loading helpers
const dataPath = filename => path.join(__dirname, filename);

// JSON data
let products = [];
let sales = [];
let stock = [];

// Load data on startup
async function loadData() {
  try {
    const [prodData, salesData, stockData] = await Promise.all([
      fs.readFile(dataPath("products.json"), "utf-8"),
      fs.readFile(dataPath("sales.json"), "utf-8"),
      fs.readFile(dataPath("stock.json"), "utf-8")
    ]);
    products = JSON.parse(prodData);
    sales = JSON.parse(salesData);
    stock = JSON.parse(stockData);
  } catch (err) {
    console.error("Error reading JSON files:", err);
  }
}

// Save data helpers
async function saveData(filename, data) {
  try {
    await fs.writeFile(dataPath(filename), JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing to ${filename}:`, err);
    throw err;
  }
}

// API: Get all products
app.get("/api/products", (req, res) => {
  res.json(products);
});

// API: Post a new sale (checkout)
app.post("/api/sale", async (req, res) => {
  const { cartItems } = req.body;

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ message: "Invalid cart data." });
  }

  let totalProfit = 0;
  let outOfStock = [];

  for (const item of cartItems) {
    const { id, quantity } = item;
    if (!id || typeof quantity !== "number" || quantity <= 0) {
      return res.status(400).json({ message: "Invalid item in cart." });
    }

    const stockItem = stock.find(p => p.id === id);
    const product = products.find(p => p.id === id);

    if (!stockItem || !product) {
      return res.status(404).json({ message: `Product not found for ID: ${id}` });
    }

    if (stockItem.stock < quantity) {
      outOfStock.push({ id, available: stockItem.stock });
      continue;
    }

    // Deduct stock and calculate profit
    stockItem.stock -= quantity;
    const profit = (product.price - stockItem.costPrice) * quantity;
    totalProfit += profit;
  }

  if (outOfStock.length > 0) {
    return res.status(400).json({
      message: "Some items are out of stock",
      items: outOfStock
    });
  }

  const sale = {
    timestamp: new Date().toISOString(),
    items: cartItems,
    profit: parseFloat(totalProfit.toFixed(2))
  };

  sales.push(sale);

  try {
    await Promise.all([
      saveData("sales.json", sales),
      saveData("stock.json", stock)
    ]);
  } catch (err) {
    return res.status(500).json({ message: "Failed to save sale data." });
  }

  res.json({
    message: "Sale recorded",
    profit: sale.profit
  });
});

// API: Sales summary report
app.get("/api/report", (req, res) => {
  const totalRevenue = sales.reduce((sum, sale) => {
    return sum + sale.items.reduce((acc, item) => {
      const product = products.find(p => p.id === item.id);
      return acc + (product ? product.price * item.quantity : 0);
    }, 0);
  }, 0);

  const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0);

  res.json({
    salesCount: sales.length,
    totalRevenue: totalRevenue.toFixed(2),
    totalProfit: totalProfit.toFixed(2)
  });
});

// Start server after loading data
loadData().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});
