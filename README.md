# mimo.

Aplicativo pessoal de organização, local-first e offline-first, criado com Expo e React Native.

## Desenvolvimento

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Inicie o aplicativo:

   ```bash
   npx expo start
   ```

3. Valide as alterações:

   ```bash
   npx expo lint
   npx tsc --noEmit
   npx expo-doctor
   ```

Os dados estruturados são armazenados no SQLite do aplicativo. Imagens e backups futuros ficam no diretório privado persistente do Mimo; não há backend nem sincronização em nuvem.
