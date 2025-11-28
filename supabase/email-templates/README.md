# Templates de Email - LLord

Este diretório contém os templates HTML para os emails enviados pelo Supabase Auth.

## Arquivos

- **confirmation-email.html**: Template para confirmação de conta (signup)
- **reset-password-email.html**: Template para recuperação de senha

## Como usar no Supabase

### Opção 1: Dashboard do Supabase

1. Acesse o [Dashboard do Supabase](https://app.supabase.com)
2. Vá em **Authentication** > **Email Templates**
3. Selecione o template que deseja editar:
   - **Confirm signup**: Use o conteúdo de `confirmation-email.html`
   - **Reset password**: Use o conteúdo de `reset-password-email.html`
4. Cole o conteúdo HTML completo do arquivo correspondente
5. Salve as alterações

### Opção 2: API do Supabase

Você também pode atualizar os templates via API usando a função `updateAuthConfig` ou através do SQL Editor.

## Variáveis disponíveis

Os templates usam as seguintes variáveis do Supabase:

- `{{ .ConfirmationURL }}`: URL de confirmação/redefinição (substituída automaticamente pelo Supabase)
- `{{ .Email }}`: Email do usuário
- `{{ .Token }}`: Token de confirmação (geralmente não usado diretamente)

## Características dos templates

✅ **Design responsivo**: Funciona bem em desktop e mobile  
✅ **Compatibilidade**: Testado em principais clientes de email  
✅ **Acessibilidade**: Cores e contrastes adequados  
✅ **CSS inline**: Usa tag `<style>` conforme solicitado  
✅ **Sem frameworks**: HTML e CSS puro  

## Personalização

Os templates usam as cores do tema do app:
- Cor primária: `#4a86e8`
- Cor primária escura: `#3844a1`
- Cor de fundo: `#f5f5f5`
- Cor de texto: `#111827`

Para personalizar, edite as cores no bloco `<style>` de cada template.

