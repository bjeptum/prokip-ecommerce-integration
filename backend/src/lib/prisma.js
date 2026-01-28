const { PrismaClient } = require('@prisma/client');

// Singleton pattern for Prisma client
class PrismaClientSingleton {
  constructor() {
    this.prisma = null;
  }

  getInstance() {
    if (!this.prisma) {
      this.prisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
        errorFormat: 'pretty'
      });
      
      // Handle graceful shutdown
      process.on('beforeExit', async () => {
        await this.prisma.$disconnect();
      });
      
      process.on('SIGINT', async () => {
        await this.prisma.$disconnect();
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        await this.prisma.$disconnect();
        process.exit(0);
      });
    }
    
    return this.prisma;
  }
}

// Create and export singleton instance
const prismaSingleton = new PrismaClientSingleton();
module.exports = prismaSingleton.getInstance();
