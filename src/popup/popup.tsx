import React from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import App from './App';

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(
  <MantineProvider forceColorScheme="light">
    <Notifications />
    <App />
  </MantineProvider>
);
