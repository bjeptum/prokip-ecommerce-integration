// Load environment variables
require('dotenv').config();

// Legacy entry point kept for compatibility.
// The real application now lives in `backend/app.js` using Express and Prisma.

const app = require('./backend/app');
const { bootstrapLegacyData } = require('./backend/services/integrationService');

const port = process.env.PORT || 3000;

bootstrapLegacyData()
  .catch(() => {
    // ignore bootstrap errors; app can still run with a fresh DB
  })
  .finally(() => {
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  });