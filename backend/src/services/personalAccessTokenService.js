const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

class PersonalAccessTokenService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Generate a Personal Access Token for a user
   */
  async generateToken(userId, connectionId, name = 'WooCommerce Integration') {
    try {
      // Generate a random token
      const token = crypto.randomBytes(32).toString('hex');
      const tokenPrefix = 'pk_';
      const fullToken = tokenPrefix + token;
      
      // Hash the token for storage
      const hashedToken = crypto.createHash('sha256').update(fullToken).digest('hex');
      
      // Set expiration (1 year from now)
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      
      // Store the token
      const personalAccessToken = await this.prisma.personalAccessToken.create({
        data: {
          userId: userId,
          connectionId: connectionId,
          name: name,
          token: hashedToken,
          tokenPrefix: tokenPrefix,
          expiresAt: expiresAt,
          isActive: true,
          lastUsedAt: new Date()
        }
      });
      
      return {
        success: true,
        data: {
          tokenId: personalAccessToken.id,
          token: fullToken, // Return full token (only shown once)
          name: name,
          expiresAt: expiresAt,
          message: 'Personal Access Token generated successfully'
        }
      };
      
    } catch (error) {
      console.error('❌ Failed to generate Personal Access Token:', error.message);
      return {
        success: false,
        error: 'Failed to generate Personal Access Token'
      };
    }
  }

  /**
   * Validate a Personal Access Token
   */
  async validateToken(token) {
    try {
      // Extract prefix and validate format
      if (!token.startsWith('pk_')) {
        throw new Error('Invalid token format');
      }
      
      // Hash the provided token
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      
      // Find the token in database
      const personalAccessToken = await this.prisma.personalAccessToken.findFirst({
        where: {
          token: hashedToken,
          isActive: true,
          expiresAt: {
            gt: new Date()
          }
        },
        include: {
          connection: true
        }
      });
      
      if (!personalAccessToken) {
        throw new Error('Invalid or expired token');
      }
      
      // Update last used timestamp
      await this.prisma.personalAccessToken.update({
        where: { id: personalAccessToken.id },
        data: { lastUsedAt: new Date() }
      });
      
      return {
        success: true,
        data: {
          tokenId: personalAccessToken.id,
          userId: personalAccessToken.userId,
          connectionId: personalAccessToken.connectionId,
          connection: personalAccessToken.connection,
          tokenName: personalAccessToken.name
        }
      };
      
    } catch (error) {
      console.error('❌ Token validation failed:', error.message);
      return {
        success: false,
        error: 'Invalid or expired token'
      };
    }
  }

  /**
   * List all tokens for a user
   */
  async listTokens(userId) {
    try {
      const tokens = await this.prisma.personalAccessToken.findMany({
        where: {
          userId: userId,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          tokenPrefix: true,
          expiresAt: true,
          lastUsedAt: true,
          createdAt: true,
          connection: {
            select: {
              id: true,
              connectionName: true,
              prokipEmail: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      return {
        success: true,
        data: tokens
      };
      
    } catch (error) {
      console.error('❌ Failed to list tokens:', error.message);
      return {
        success: false,
        error: 'Failed to list tokens'
      };
    }
  }

  /**
   * Revoke a token
   */
  async revokeToken(tokenId, userId) {
    try {
      const token = await this.prisma.personalAccessToken.findFirst({
        where: {
          id: tokenId,
          userId: userId
        }
      });
      
      if (!token) {
        throw new Error('Token not found');
      }
      
      await this.prisma.personalAccessToken.update({
        where: { id: tokenId },
        data: { isActive: false }
      });
      
      return {
        success: true,
        message: 'Token revoked successfully'
      };
      
    } catch (error) {
      console.error('❌ Failed to revoke token:', error.message);
      return {
        success: false,
        error: 'Failed to revoke token'
      };
    }
  }
}

module.exports = PersonalAccessTokenService;
