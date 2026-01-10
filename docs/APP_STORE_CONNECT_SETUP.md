# Configuração do Apple App Store Connect para In-App Purchases

Este guia descreve como configurar os produtos de assinatura no App Store Connect para habilitar pagamentos via Apple App Store.

## Pré-requisitos

1. Conta de desenvolvedor Apple ativa (US$ 99/ano)
2. App registrado no App Store Connect
3. Bundle ID: `com.kavicki.com.llord` (já configurado)

## Passo 1: Acessar App Store Connect

1. Acesse [App Store Connect](https://appstoreconnect.apple.com/)
2. Faça login com sua conta de desenvolvedor
3. Selecione seu app (ou crie um novo se necessário)

## Passo 2: Criar Grupo de Assinatura

1. No menu lateral, vá em **In-App Purchases**
2. Clique em **Subscription Groups** (Grupos de Assinatura)
3. Clique no botão **+** para criar um novo grupo
4. Dê um nome ao grupo, por exemplo: "Planos de Assinatura"
5. Salve o grupo

## Passo 3: Criar Produtos de Assinatura

Para cada plano (Básico e Premium), você precisa criar um produto:

### 3.1 Plano Básico

1. No grupo criado, clique em **+** para adicionar uma assinatura
2. Preencha as informações:

   - **Reference Name**: Plano Básico
   - **Product ID**: `com.kavicki.com.llord.subscription.basic.monthly`
   - **Subscription Duration**: 1 Month
   - **Price**: Selecione o preço (R$ 19,90 para Brasil)
   - **Localization**: Adicione em Português (Brasil)
     - Display Name: "Plano Básico"
     - Description: "Até 10 imóveis e 10 inquilinos. Inclui gestão de contratos, documentos, lançamentos financeiros e relatórios."

3. Configure os níveis do grupo:
   - Defina o nível (Level): 1 (para Básico)
   
4. Salve o produto

### 3.2 Plano Premium

1. Repita o processo acima para o Plano Premium:
   - **Reference Name**: Plano Premium
   - **Product ID**: `com.kavicki.com.llord.subscription.premium.monthly`
   - **Subscription Duration**: 1 Month
   - **Price**: Selecione o preço (R$ 39,90 para Brasil)
   - **Localization**: 
     - Display Name: "Plano Premium"
     - Description: "Ilimitado imóveis e inquilinos. Inclui todos os recursos do Plano Básico mais suporte prioritário."
   - **Level**: 2 (maior que o Básico para permitir upgrade automático)

5. Salve o produto

## Passo 4: Configurar Shared Secret (Opcional mas Recomendado)

O Shared Secret é necessário para validação de receipts no servidor:

1. No App Store Connect, vá em **App Information**
2. Role até a seção **App-Specific Shared Secret**
3. Clique em **Generate** para criar um shared secret
4. Copie o shared secret gerado
5. Configure como variável de ambiente no Supabase:
   - Nome: `APPLE_IAP_SHARED_SECRET`
   - Valor: (o shared secret copiado)

Para configurar no Supabase:
1. Acesse o Dashboard do Supabase
2. Vá em **Project Settings** > **Edge Functions** > **Secrets**
3. Adicione a variável `APPLE_IAP_SHARED_SECRET` com o valor

## Passo 5: Configurar Preços por Região

1. Para cada produto, configure os preços para diferentes regiões:
   - Brasil: R$ 19,90 (Básico) e R$ 39,90 (Premium)
   - Outros países: Configure conforme necessário

2. A Apple converterá automaticamente para a moeda local

## Passo 6: Configurar Upgrade/Downgrade Automático

1. No grupo de assinatura, você pode configurar:
   - **Upgrade**: Permitir que usuários façam upgrade automaticamente
   - **Downgrade**: Configurar período de grace para downgrade

## Passo 7: Criar Contas Sandbox para Testes

Antes de testar, você precisa criar contas de teste:

1. No App Store Connect, vá em **Users and Access**
2. Clique em **Sandbox Testers**
3. Clique no botão **+** para adicionar um testador
4. Preencha:
   - Email: (use um email válido que NÃO seja um Apple ID real)
   - Password: (senha para o teste)
   - Country/Region: Brasil
   - First Name e Last Name: (opcional)

5. Salve o testador

**IMPORTANTE**: 
- Use emails que não sejam Apple IDs reais
- Você precisará fazer logout da sua conta Apple no dispositivo antes de testar
- Faça login com a conta Sandbox quando solicitado durante a compra de teste

## Passo 8: Testar no Dispositivo

1. Crie um build de desenvolvimento usando EAS Build:
   ```bash
   eas build --profile development --platform ios
   ```

2. Instale o build no dispositivo físico iOS (IAP não funciona em simulador)

3. No dispositivo:
   - Vá em **Settings** > **App Store**
   - Faça logout da sua conta Apple (se estiver logado)
   - Abra o app
   - Tente fazer uma compra
   - Quando solicitado, faça login com a conta Sandbox criada

4. Teste o fluxo completo:
   - Listar produtos
   - Comprar assinatura
   - Verificar atualização no banco de dados
   - Restaurar compras
   - Testar cancelamento (via Settings > Subscriptions)

## Passo 9: Submeter para Revisão

Antes de submeter o app para revisão da Apple:

1. Certifique-se de que:
   - Todos os produtos estão configurados
   - Preços estão definidos
   - Descrições estão completas
   - Política de privacidade está configurada
   - Termos de uso estão disponíveis

2. No App Store Connect, submeta o app para revisão
3. A Apple revisará os produtos de assinatura junto com o app

## Troubleshooting

### Erro: "Product ID não encontrado"
- Verifique se o Product ID está exatamente como configurado no App Store Connect
- Certifique-se de que o produto foi aprovado (status: Ready to Submit ou Approved)
- Em desenvolvimento, produtos precisam estar com status "Ready to Submit" no mínimo

### Erro: "Este ambiente não é suportado"
- Em desenvolvimento/testes, você precisa usar conta Sandbox
- Certifique-se de fazer logout da conta Apple real no dispositivo
- Use a conta Sandbox durante a compra

### Receipt validation falha
- Verifique se o shared secret está configurado corretamente
- Certifique-se de que a Edge Function está deployada
- Verifique os logs da Edge Function no Supabase

### Produtos não aparecem no app
- Verifique se o Bundle ID do app corresponde ao Bundle ID configurado no App Store Connect
- Certifique-se de que os produtos estão no status correto
- Em desenvolvimento, pode levar alguns minutos para produtos ficarem disponíveis após criação

## Referências

- [Documentação oficial do App Store Connect](https://developer.apple.com/app-store-connect/)
- [Guia de In-App Purchases da Apple](https://developer.apple.com/in-app-purchase/)
- [Documentação do expo-in-app-purchases](https://docs.expo.dev/versions/latest/sdk/in-app-purchases/)

## Product IDs Configurados

- Básico: `com.kavicki.com.llord.subscription.basic.monthly`
- Premium: `com.kavicki.com.llord.subscription.premium.monthly`

Estes IDs estão configurados no código em `lib/iapService.js`. Se você alterar os IDs no App Store Connect, lembre-se de atualizar no código também.
