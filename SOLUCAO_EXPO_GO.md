# Solução para Expo Go - Deep Linking

## Problema Identificado

O Expo Go tem limitações sérias com deep linking, especialmente com URLs que contêm parâmetros de autenticação do Supabase. Por isso, implementei uma solução alternativa.

## Soluções Implementadas

### 1. **Botão de Teste Manual**
- Adicionei um botão "🧪 Testar Deep Link" na tela de login
- Permite testar o deep link manualmente durante desenvolvimento
- Mostra a URL que deve ser copiada e colada no Expo Go

### 2. **URL Simplificada**
- Usa `exp://192.168.1.75:8081/--/reset` (sem parâmetros complexos)
- Detecção simples: qualquer URL que contenha "reset"

### 3. **Página Web Intermediária** (Opcional)
- Criada `public/reset-password.html` que redireciona para o app
- Pode ser hospedada em qualquer servidor web

## Como Testar

### Método 1: Botão de Teste (Recomendado para desenvolvimento)
1. Execute: `npx expo start`
2. Abra no Expo Go
3. Na tela de login, clique em "🧪 Testar Deep Link"
4. Copie a URL mostrada
5. Cole no campo de URL do Expo Go
6. Pressione "Open"

### Método 2: Fluxo Real
1. Vá para "Esqueci minha senha"
2. Insira um email
3. Verifique o email recebido
4. **Se o deep link não funcionar automaticamente:**
   - Copie a URL do email
   - Cole no Expo Go manualmente

### Método 3: URL Direta
1. No Expo Go, digite: `exp://192.168.1.75:8081/--/reset`
2. Pressione "Open"
3. Deve navegar para a tela de reset de senha

## Logs Esperados

```
Using redirect URL: exp://192.168.1.75:8081/--/reset
Deep link received: exp://192.168.1.75:8081/--/reset
Navigating to ResetPassword screen
```

## Limitações do Expo Go

- **Deep linking complexo**: Não funciona bem com URLs que contêm parâmetros
- **Parâmetros de autenticação**: O Supabase adiciona tokens que o Expo Go não processa bem
- **URLs longas**: Podem ser truncadas ou causar erro

## Solução para Produção

Em produção (build real), o deep linking funciona normalmente porque:
- Não usa Expo Go
- Tem configuração nativa de deep linking
- Processa URLs corretamente

## Próximos Passos

1. **Teste com o botão manual** primeiro
2. **Se funcionar**, o problema é apenas com o Expo Go
3. **Em produção**, deve funcionar normalmente
4. **Considere usar uma página web** como intermediária se necessário

## Alternativa: Página Web

Se o deep linking direto não funcionar, pode usar:
1. Hospedar `public/reset-password.html` em um servidor
2. Configurar Supabase para redirecionar para essa página
3. A página redireciona para o app


