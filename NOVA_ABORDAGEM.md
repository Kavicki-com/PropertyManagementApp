# Nova Abordagem - Deep Linking Simplificado

## O que mudou:

1. **URL Simplificada**: `exp://192.168.1.75:8081/--/reset` (sem "password")
2. **Detecção Simples**: Qualquer URL que contenha "reset" navega para ResetPassword
3. **Linking Configurado**: Mapeia "reset" para a tela ResetPassword

## Como testar:

### 1. Execute o app
```bash
npx expo start
```

### 2. Abra no Expo Go
- Escaneie o QR code

### 3. Teste o fluxo
1. Vá para "Esqueci minha senha"
2. Insira um email válido
3. Clique em "Enviar Link de Recuperação"
4. Verifique o email recebido
5. **Clique no link do email**

### 4. Logs esperados
```
Using redirect URL: exp://192.168.1.75:8081/--/reset
Deep link received: exp://192.168.1.75:8081/--/reset#access_token=...
Navigating to ResetPassword screen
```

### 5. Resultado esperado
- App abre automaticamente
- Navega para tela de reset de senha
- Usuário pode definir nova senha

## Se ainda não funcionar:

Vamos tentar uma abordagem ainda mais simples - usar uma URL web que redireciona para o app.

### Alternativa: URL Web
Se o deep linking direto não funcionar, podemos usar:
- URL web: `https://auth.expo.io/@kavicki.com/llord/reset`
- Que redireciona para: `exp://192.168.1.75:8081/--/reset`

## Vantagens desta abordagem:

1. **URL mais curta**: Menos chance de erro
2. **Detecção simples**: Apenas verifica se contém "reset"
3. **Menos complexidade**: Remove lógica desnecessária
4. **Mais confiável**: Funciona melhor com Expo Go

