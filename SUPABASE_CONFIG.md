# Configuração do Supabase para Reset de Senha

## Configurações necessárias no Supabase Dashboard

Para que o redirecionamento funcione corretamente, você precisa configurar as seguintes URLs no painel do Supabase:

### 1. Acesse o Supabase Dashboard
- Vá para [https://supabase.com/dashboard](https://supabase.com/dashboard)
- Selecione seu projeto

### 2. Configure as URLs de redirecionamento
- Vá para **Authentication** > **URL Configuration**
- Em **Site URL**, adicione uma URL **HTTPS** estável do seu projeto (por exemplo, a URL onde você vai hospedar a página de reset de senha deste repositório):  
  - Exemplo: `https://seu-dominio.com/reset-password` ou a URL pública gerada pelo seu provedor de hosting.
- Em **Redirect URLs**, adicione **apenas** os esquemas de deep link que o app consegue abrir diretamente:
  - `llord://reset-password`
  - (Opcional, para desenvolvimento com Expo Go) uma URL `exp://.../--/reset-password` correspondente ao seu servidor local.

### 3. Configurações adicionais
- Certifique-se de que **Enable email confirmations** está habilitado
- Configure o **Email template** para reset de senha se necessário

## Como funciona o fluxo

1. **Usuário solicita reset**: Na tela `ForgotPasswordScreen`, o usuário insere o email
2. **Email enviado**: Supabase envia email com um link HTTPS para a sua **Site URL**, incluindo os parâmetros de reset de senha.
3. **Deep link**: Sua página web (por exemplo, `public/reset-password.html`) lê os parâmetros da URL e redireciona o usuário para o deep link `llord://reset-password` (ou, em desenvolvimento, para o link `exp://.../--/reset-password`).
4. **Navegação**: O app detecta o deep link e navega para `ResetPasswordScreen`
5. **Reset da senha**: O usuário define nova senha

## Testando

### No Expo Go (Desenvolvimento)
1. Execute o app: `npx expo start`
2. Abra no Expo Go
3. Navegue para a tela de "Esqueci minha senha"
4. Insira um email válido
5. Verifique o email recebido
6. Clique no link - o app deve abrir na tela de reset de senha

### Em Produção
1. Build do app: `eas build`
2. Instale o app no dispositivo
3. Teste o mesmo fluxo

## Troubleshooting

- **Expo Go**: Se o deep link não funcionar, verifique se as URLs `exp://` estão configuradas no Supabase
- **Produção**: Se o deep link não funcionar, verifique se o `app.json` está configurado corretamente
- **Android**: Certifique-se de que o `intentFilters` está presente
- **iOS**: Verifique se o `CFBundleURLTypes` está configurado
- **Teste**: Use dispositivo real, deep links podem não funcionar no emulador
- **URLs**: O app detecta automaticamente se está no Expo Go ou produção e usa a URL correta
