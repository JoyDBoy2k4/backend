const express = require("express");
const fs = require("fs");
const cors = require("cors");
const path = require("path");
const app = express();

// IMPORTANT: Use Render's assigned port or fallback to 3000 locally
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files for images (adjust path if needed)
app.use("/assets", express.static(path.join(__dirname, "assets")));

// Load data once on startup
let products = JSON.parse(fs.readFileSync("products.json", "utf-8"));
let sales = JSON.parse(fs.readFileSync("sales.json", "utf-8"));
let stock = JSON.parse(fs.readFileSync("stock.json", "utf-8"));

// Get all products endpoint
app.get("/api/products", (req, res) => {
  res.json(products);
});

// Handle sale (checkout)
app.post("/api/sale", (req, res) => {
  const { cartItems } = req.body;

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ message: "Invalid cart data." });
  }

  let totalProfit = 0;
  let outOfStock = [];

  cartItems.forEach(item => {
    const stockItem = stock.find(p => p.id === item.id);
    if (!stockItem) return;

    if (stockItem.stock < item.quantity) {
      outOfStock.push(item.id);
      return;
    }

    stockItem.stock -= item.quantity;

    // Calculate profit (item.price - costPrice)
    const profit = (item.price - stockItem.costPrice) * item.quantity;
    totalProfit += profit;
  });

  if (outOfStock.length > 0) {
    return res.status(400).json({
      message: `Not enough stock for: ${outOfStock.join(", ")}`
    });
  }

  const sale = {
    timestamp: new Date().toISOString(),
    items: cartItems,
    profit: totalProfit
  };

  sales.push(sale);

  fs.writeFileSync("sales.json", JSON.stringify(sales, null, 2));
  fs.writeFileSync("stock.json", JSON.stringify(stock, null, 2));

  res.json({
    message: "Sale recorded",
    profit: totalProfit.toFixed(2)
  });
});

// Get sales report summary
app.get("/api/report", (req, res) => {
  const totalRevenue = sales.reduce((sum, sale) => {
    const saleTotal = sale.items.reduce((itemSum, item) =>
      itemSum + (item.price * item.quantity), 0);
    return sum + saleTotal;
  }, 0);

  res.json({
    salesCount: sales.length,
    totalRevenue: totalRevenue.toFixed(2),
    totalProfit: sales.reduce((sum, sale) => sum + sale.profit, 0).toFixed(2)
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
