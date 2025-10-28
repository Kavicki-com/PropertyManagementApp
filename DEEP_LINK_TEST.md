# Teste de Deep Linking

## Como testar o deep linking

### 1. Teste Manual
1. Execute o app: `npx expo start`
2. Abra no Expo Go
3. Vá para a tela "Esqueci minha senha"
4. Insira um email válido
5. Verifique o console para logs:
   - `Using redirect URL: exp://localhost:8081/--/reset-password`
   - `Deep link received: [URL]`
   - `Navigating to ResetPassword screen`

### 2. Teste Direto do Deep Link
1. Abra o Expo Go
2. No campo de URL, digite: `exp://localhost:8081/--/reset-password`
3. Pressione "Open"
4. O app deve navegar para a tela de reset de senha

### 3. Verificar Logs
Os logs devem mostrar:
- `App ownership: expo` (se estiver no Expo Go)
- `Is Expo Go: true` (se estiver no Expo Go)
- `Using redirect URL: exp://localhost:8081/--/reset-password`
- `Deep link received: [URL completa]`
- `Navigating to ResetPassword screen`

### 4. Problemas Comuns
- Se não aparecer logs, verifique se o console está aberto
- Se o deep link não funcionar, tente reiniciar o Expo Go
- Se a navegação não funcionar, verifique se a tela ResetPassword está registrada

### 5. Debug Adicional
Se ainda não funcionar, adicione este código temporário no App.js para debug:

```javascript
// Adicione no useEffect
console.log('Navigation ref:', navigationRef.current);
console.log('Available routes:', navigationRef.current?.getRootState());
```


