/**
 * Network Service
 * Monitora status de conexão e dispara sincronização quando online
 */

import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import { logger } from './logger';

type NetworkListener = (isOnline: boolean) => void;

class NetworkService {
  private listeners: Set<NetworkListener> = new Set();
  private subscription: NetInfoSubscription | null = null;
  private isOnline: boolean = true;

  /**
   * Inicia o monitoramento de rede
   */
  start(): void {
    if (this.subscription) {
      return; // Já está monitorando
    }

    this.subscription = NetInfo.addEventListener((state: NetInfoState) => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected === true && state.isInternetReachable !== false;

      if (wasOnline !== this.isOnline) {
        logger.info('Status de rede alterado', {
          isOnline: this.isOnline,
          type: state.type,
          isConnected: state.isConnected,
          isInternetReachable: state.isInternetReachable,
        });

        // Notificar listeners
        this.listeners.forEach((listener) => {
          try {
            listener(this.isOnline);
          } catch (error) {
            logger.error('Erro no listener de rede', { error });
          }
        });
      }
    });

    logger.info('NetworkService iniciado');
  }

  /**
   * Para o monitoramento de rede
   */
  stop(): void {
    if (this.subscription) {
      this.subscription();
      this.subscription = null;
      logger.info('NetworkService parado');
    }
  }

  /**
   * Retorna o status atual de conexão
   */
  async getStatus(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      this.isOnline = state.isConnected === true && state.isInternetReachable !== false;
      return this.isOnline;
    } catch (error) {
      logger.error('Erro ao verificar status de rede', { error });
      return false;
    }
  }

  /**
   * Adiciona um listener para mudanças de rede
   */
  addListener(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Retorna se está online (cache)
   */
  get online(): boolean {
    return this.isOnline;
  }
}

export const networkService = new NetworkService();
