# Instruções de Teste - Deep Linking

## O que foi corrigido:

1. **Deep linking simplificado**: Remove a lógica de sessão automática (usuário deve estar deslogado)
2. **Navegação direta**: Navega diretamente para a tela de reset de senha
3. **Fluxo correto**: Usuário deslogado pode redefinir senha via deep link

## Como testar:

### 1. Execute o app
```bash
npx expo start
```

### 2. Abra no Expo Go
- Escaneie o QR code ou use o link

### 3. Teste o fluxo completo
1. Vá para "Esqueci minha senha"
2. Insira um email válido
3. Clique em "Enviar Link de Recuperação"
4. Verifique o email recebido
5. **Clique no link do email**

### 4. Verifique os logs no console
Você deve ver:
```
Using redirect URL: exp://localhost:8081/--/reset-password
Deep link received: exp://localhost:8081/--/reset-password#access_token=...
Navigating to ResetPassword screen
```

### 5. Resultado esperado
- O app deve abrir automaticamente
- Deve navegar para a tela de reset de senha
- O usuário deve estar **deslogado** (correto para reset de senha)
- Pode definir nova senha

## Se ainda não funcionar:

1. **Verifique os logs**: Me diga quais logs aparecem
2. **Teste manual**: Tente colar a URL diretamente no Expo Go
3. **Reinicie o Expo Go**: Às vezes ajuda limpar o cache

## Troubleshooting:

- Se aparecer "Could not connect to server", o problema é que o Expo Go não consegue processar a URL com parâmetros
- A solução implementada agora processa esses parâmetros corretamente
- Se ainda não funcionar, pode ser necessário usar uma abordagem diferente (como uma página web intermediária)
