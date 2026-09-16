import { ReactElement, ReactNode } from 'react';

declare global {
  interface Window {
    ethereum?: import('viem').EIP1193Provider;
  }

  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
} 