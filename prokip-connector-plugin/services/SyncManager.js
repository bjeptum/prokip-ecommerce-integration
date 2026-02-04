const crypto = require('crypto');
const EventEmitter = require('events');

class SyncManager extends EventEmitter {
  constructor(prokipService, platformAdapterFactory) {
    super();
    this.prokipService = prokipService;
    this.platformAdapterFactory = platformAdapterFactory;
    this.activeJobs = new Map(); // Track active sync jobs
    this.jobHistory = new Map(); // Store job history
  }
  
  /**
   * Start product sync for a store
   */
  async syncProducts(storeId, options = {}) {
    try {
      const jobId = this.generateJobId();
      const job = this.createJob(jobId, 'products', storeId, options);
      
      console.log(`📦 Starting product sync job: ${jobId} for store: ${storeId}`);
      
      // Start async sync process
      this.runProductSync(job).catch(error => {
        console.error(`❌ Product sync job ${jobId} failed:`, error.message);
        this.updateJobStatus(jobId, 'failed', error.message);
      });
      
      return {
        id: jobId,
        status: 'started',
        message: 'Product sync started',
        created_at: job.created_at
      };
      
    } catch (error) {
      console.error('❌ Failed to start product sync:', error.message);
      throw error;
    }
  }
  
  /**
   * Start order sync for a store
   */
  async syncOrders(storeId, options = {}) {
    try {
      const jobId = this.generateJobId();
      const job = this.createJob(jobId, 'orders', storeId, options);
      
      console.log(`📋 Starting order sync job: ${jobId} for store: ${storeId}`);
      
      // Start async sync process
      this.runOrderSync(job).catch(error => {
        console.error(`❌ Order sync job ${jobId} failed:`, error.message);
        this.updateJobStatus(jobId, 'failed', error.message);
      });
      
      return {
        id: jobId,
        status: 'started',
        message: 'Order sync started',
        created_at: job.created_at
      };
      
    } catch (error) {
      console.error('❌ Failed to start order sync:', error.message);
      throw error;
    }
  }
  
  /**
   * Run product sync process
   */
  async runProductSync(job) {
    try {
      this.updateJobStatus(job.id, 'running', 'Fetching store details...');
      
      // Get store details from Prokip
      const stores = await this.prokipService.getStores();
      const store = stores.stores.find(s => s.id.toString() === job.store_id.toString());
      
      if (!store) {
        throw new Error('Store not found');
      }
      
      this.updateJobStatus(job.id, 'running', `Connecting to ${store.platform} store...`);
      
      // Get platform adapter
      const adapter = this.platformAdapterFactory.getAdapter(store.platform);
      
      // Sync products with pagination
      let allProducts = [];
      let page = 1;
      let hasMore = true;
      let totalSynced = 0;
      
      while (hasMore) {
        this.updateJobStatus(job.id, 'running', `Syncing page ${page}...`);
        
        const options = {
          page,
          limit: job.options.limit || 100,
          ...job.options
        };
        
        const result = await this.prokipService.retry(
          () => adapter.fetchProducts(store.store_url, store.credentials, options),
          3,
          2000
        );
        
        if (!result.success) {
          throw new Error(`Failed to fetch products: ${result.error}`);
        }
        
        allProducts = allProducts.concat(result.products);
        totalSynced += result.products.length;
        hasMore = result.hasMore || (result.totalPages && page < result.totalPages);
        page++;
        
        // Update progress
        const progress = hasMore ? Math.min((totalSynced / (result.total || totalSynced)) * 100, 95) : 100;
        this.updateJobProgress(job.id, progress);
        
        // Emit progress event
        this.emit('sync:progress', {
          job_id: job.id,
          type: 'products',
          progress,
          synced: totalSynced,
          total: result.total || 'unknown'
        });
        
        // Brief pause to avoid rate limiting
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Send products to Prokip
      this.updateJobStatus(job.id, 'running', 'Sending products to Prokip...');
      
      const batchSize = 50;
      for (let i = 0; i < allProducts.length; i += batchSize) {
        const batch = allProducts.slice(i, i + batchSize);
        
        const batchResult = await this.prokipService.retry(
          () => this.sendProductsToProkip(job.store_id, batch),
          3,
          3000
        );
        
        if (!batchResult.success) {
          throw new Error(`Failed to send products to Prokip: ${batchResult.error}`);
        }
        
        // Update progress
        const progress = 95 + ((i + batch.length) / allProducts.length) * 5;
        this.updateJobProgress(job.id, progress);
        
        // Brief pause between batches
        if (i + batchSize < allProducts.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Complete job
      this.updateJobStatus(job.id, 'completed', `Successfully synced ${totalSynced} products`);
      this.updateJobProgress(job.id, 100);
      
      // Emit completion event
      this.emit('sync:completed', {
        job_id: job.id,
        type: 'products',
        synced: totalSynced,
        store_id: job.store_id
      });
      
      console.log(`✅ Product sync job ${job.id} completed: ${totalSynced} products synced`);
      
    } catch (error) {
      this.updateJobStatus(job.id, 'failed', error.message);
      this.emit('sync:failed', {
        job_id: job.id,
        type: 'products',
        error: error.message,
        store_id: job.store_id
      });
      throw error;
    }
  }
  
  /**
   * Run order sync process
   */
  async runOrderSync(job) {
    try {
      this.updateJobStatus(job.id, 'running', 'Fetching store details...');
      
      // Get store details from Prokip
      const stores = await this.prokipService.getStores();
      const store = stores.stores.find(s => s.id.toString() === job.store_id.toString());
      
      if (!store) {
        throw new Error('Store not found');
      }
      
      this.updateJobStatus(job.id, 'running', `Connecting to ${store.platform} store...`);
      
      // Get platform adapter
      const adapter = this.platformAdapterFactory.getAdapter(store.platform);
      
      // Sync orders with pagination
      let allOrders = [];
      let page = 1;
      let hasMore = true;
      let totalSynced = 0;
      
      while (hasMore) {
        this.updateJobStatus(job.id, 'running', `Syncing page ${page}...`);
        
        const options = {
          page,
          limit: job.options.limit || 100,
          status: job.options.status || 'completed',
          after: job.options.after || null,
          ...job.options
        };
        
        const result = await this.prokipService.retry(
          () => adapter.fetchOrders(store.store_url, store.credentials, options),
          3,
          2000
        );
        
        if (!result.success) {
          throw new Error(`Failed to fetch orders: ${result.error}`);
        }
        
        allOrders = allOrders.concat(result.orders);
        totalSynced += result.orders.length;
        hasMore = result.hasMore || (result.totalPages && page < result.totalPages);
        page++;
        
        // Update progress
        const progress = hasMore ? Math.min((totalSynced / (result.total || totalSynced)) * 100, 95) : 100;
        this.updateJobProgress(job.id, progress);
        
        // Emit progress event
        this.emit('sync:progress', {
          job_id: job.id,
          type: 'orders',
          progress,
          synced: totalSynced,
          total: result.total || 'unknown'
        });
        
        // Brief pause to avoid rate limiting
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Send orders to Prokip
      this.updateJobStatus(job.id, 'running', 'Sending orders to Prokip...');
      
      const batchSize = 50;
      for (let i = 0; i < allOrders.length; i += batchSize) {
        const batch = allOrders.slice(i, i + batchSize);
        
        const batchResult = await this.prokipService.retry(
          () => this.sendOrdersToProkip(job.store_id, batch),
          3,
          3000
        );
        
        if (!batchResult.success) {
          throw new Error(`Failed to send orders to Prokip: ${batchResult.error}`);
        }
        
        // Update progress
        const progress = 95 + ((i + batch.length) / allOrders.length) * 5;
        this.updateJobProgress(job.id, progress);
        
        // Brief pause between batches
        if (i + batchSize < allOrders.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Complete job
      this.updateJobStatus(job.id, 'completed', `Successfully synced ${totalSynced} orders`);
      this.updateJobProgress(job.id, 100);
      
      // Emit completion event
      this.emit('sync:completed', {
        job_id: job.id,
        type: 'orders',
        synced: totalSynced,
        store_id: job.store_id
      });
      
      console.log(`✅ Order sync job ${job.id} completed: ${totalSynced} orders synced`);
      
    } catch (error) {
      this.updateJobStatus(job.id, 'failed', error.message);
      this.emit('sync:failed', {
        job_id: job.id,
        type: 'orders',
        error: error.message,
        store_id: job.store_id
      });
      throw error;
    }
  }
  
  /**
   * Send products to Prokip API
   */
  async sendProductsToProkip(storeId, products) {
    try {
      // This would call Prokip API to receive products
      // For now, simulate success
      console.log(`📦 Sending ${products.length} products to Prokip for store ${storeId}`);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        success: true,
        processed: products.length,
        message: 'Products sent to Prokip successfully'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        processed: 0
      };
    }
  }
  
  /**
   * Send orders to Prokip API
   */
  async sendOrdersToProkip(storeId, orders) {
    try {
      // This would call Prokip API to receive orders
      // For now, simulate success
      console.log(`📋 Sending ${orders.length} orders to Prokip for store ${storeId}`);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        success: true,
        processed: orders.length,
        message: 'Orders sent to Prokip successfully'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        processed: 0
      };
    }
  }
  
  /**
   * Get sync job status
   */
  async getSyncStatus(jobId) {
    const job = this.activeJobs.get(jobId) || this.jobHistory.get(jobId);
    
    if (!job) {
      return null;
    }
    
    return {
      id: job.id,
      type: job.type,
      store_id: job.store_id,
      status: job.status,
      progress: job.progress,
      message: job.message,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      error: job.error,
      options: job.options,
      stats: job.stats
    };
  }
  
  /**
   * Get all sync jobs (active and recent history)
   */
  async getAllSyncJobs(storeId = null, limit = 50) {
    const allJobs = [];
    
    // Add active jobs
    for (const job of this.activeJobs.values()) {
      if (!storeId || job.store_id.toString() === storeId.toString()) {
        allJobs.push(this.formatJobForResponse(job));
      }
    }
    
    // Add historical jobs
    for (const job of this.jobHistory.values()) {
      if (!storeId || job.store_id.toString() === storeId.toString()) {
        allJobs.push(this.formatJobForResponse(job));
      }
    }
    
    // Sort by created_at descending
    allJobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return allJobs.slice(0, limit);
  }
  
  /**
   * Cancel a sync job
   */
  async cancelSyncJob(jobId) {
    const job = this.activeJobs.get(jobId);
    
    if (!job) {
      return {
        success: false,
        error: 'Job not found or already completed'
      };
    }
    
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return {
        success: false,
        error: 'Job cannot be cancelled'
      };
    }
    
    this.updateJobStatus(jobId, 'cancelled', 'Job cancelled by user');
    
    // Emit cancellation event
    this.emit('sync:cancelled', {
      job_id: jobId,
      type: job.type,
      store_id: job.store_id
    });
    
    return {
      success: true,
      message: 'Job cancelled successfully'
    };
  }
  
  /**
   * Create a new sync job
   */
  createJob(jobId, type, storeId, options) {
    const job = {
      id: jobId,
      type,
      store_id: storeId,
      status: 'started',
      progress: 0,
      message: 'Job started',
      created_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      completed_at: null,
      error: null,
      options,
      stats: {
        synced: 0,
        total: 0,
        errors: 0
      }
    };
    
    this.activeJobs.set(jobId, job);
    return job;
  }
  
  /**
   * Update job status
   */
  updateJobStatus(jobId, status, message = null) {
    const job = this.activeJobs.get(jobId);
    
    if (!job) {
      return;
    }
    
    job.status = status;
    if (message) {
      job.message = message;
    }
    
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      job.completed_at = new Date().toISOString();
      
      // Move to history
      this.activeJobs.delete(jobId);
      this.jobHistory.set(jobId, job);
      
      // Clean up old history (keep last 100 jobs)
      if (this.jobHistory.size > 100) {
        const oldestJob = Array.from(this.jobHistory.keys())[0];
        this.jobHistory.delete(oldestJob);
      }
    }
  }
  
  /**
   * Update job progress
   */
  updateJobProgress(jobId, progress) {
    const job = this.activeJobs.get(jobId);
    
    if (job) {
      job.progress = Math.min(Math.max(progress, 0), 100);
    }
  }
  
  /**
   * Generate unique job ID
   */
  generateJobId() {
    return `sync_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }
  
  /**
   * Format job for API response
   */
  formatJobForResponse(job) {
    return {
      id: job.id,
      type: job.type,
      store_id: job.store_id,
      status: job.status,
      progress: job.progress,
      message: job.message,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      error: job.error,
      stats: job.stats
    };
  }
}

module.exports = SyncManager;
