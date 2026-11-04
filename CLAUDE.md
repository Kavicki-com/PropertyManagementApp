# Llord (PropertyManagementApp)

> Situação atualizada em 2026-11-04. Repositório público: não registre aqui segredos, chaves nem dados de usuários.

## 1. O que é o app

Llord é um SaaS mobile de gestão imobiliária (`screens/TermsOfServiceScreen.js`) para quem administra imóveis alugados: imóveis, inquilinos, contratos, lançamentos financeiros, documentos e notificações de aluguel.

Planos (`screens/FAQScreen.js`): gratuito (até 2 imóveis e 2 inquilinos), Básico (R$ 19,90/mês, até 10) e Premium (R$ 39,90/mês, ilimitado), vendidos por assinatura na App Store.

O repo não tem README; esta descrição vem do código.

## 2. Stack

- **App** (`package.json`): Expo ~57.0.24, React Native 0.86.3, React 19.2.3, JavaScript com TypeScript ~6.0.3 na configuração.
- **Navegação e UI:** React Navigation 6, React Native Paper ^5.7.0, Reanimated 4.5.1.
- **Backend:** Supabase (supabase-js ^2.74.0), com Edge Functions em `supabase/functions/` e SQL em `supabase/migrations/` e soltos em `supabase/`.
- **Assinaturas:** expo-iap ^5.6.2 (StoreKit 2).
- **Identificação** (`app.json`): nome `llord`, versão 1.1.0, `runtimeVersion` pela versão do app, `expo-updates` ativo. `eas.json` tem perfis development, preview e production.

**Comandos:** `npm start`, `npm run ios`, `npm run android`. `package.json` não tem scripts de teste nem lint. `.npmrc` usa `legacy-peer-deps=true`.

**Cuidado com `eas update`:** como `runtimeVersion` segue a versão do app, manter a mesma versão com outra versão de React Native mandaria bundle incompatível aos binários publicados (`311cf2e`).

## 3. Situação real

**Produção nas lojas, com evidência só para a App Store.**

| Afirmação | Evidência | Data |
|---|---|---|
| Há binários na App Store | commit `311cf2e`: "binários RN 0.81 que estão na App Store" | 2026-09-18 |
| Há usuários reais | commit `356cef5`: "nove usuários reais" | 2026-09-17 |
| Há assinante real | commit `311cf2e` | 2026-09-18 |
| Marco inicial no TestFlight | commit `ef99c92`: "V1.0 - tesflight launch" | 2025-10-10 |

Ressalva: a evidência são mensagens de commit, não link público de loja. Reconfirmar no App Store Connect.

- **Versão publicada:** `app.json` está em 1.1.0 desde `311cf2e`, mas build e envio dessa versão: não determinado pelos arquivos. O próprio commit diz que as mudanças de 17/09 só chegam aos usuários com build novo.
- **Google Play:** `eas.json` e o pacote Android são configuração, não publicação. `android/app/build.gradle` mantém `versionCode 1`, e o IAP é só iOS (`lib/iapService.js:251`). Publicação no Google Play: não determinado pelos arquivos.
- **Revisão da Apple:** há ajuste por política da Apple (`9fdf0f5`, 2026-01-12), sem registro do status atual de revisão.

## 4. Em andamento

- Branch `main` em `52ae417` (PR #24, 2026-09-21), alinhada com `origin/main`. Nenhuma branch tem commits fora de `main`.
- Último ciclo (17 a 21/09/2026): correções do Lote 1, Expo SDK 54 para 57, migração para `expo-iap`, cadastro enxuto, Lote 7 e ajustes de dinheiro e login.
- **Não commitado** (`git diff --stat`): `app.json`, 1 linha, adiciona `"enableFullScreenImage_legacy": true` ao plugin `expo-splash-screen`. Parece ajuste do splash do SDK 57 (`547b99d`), mas o motivo não está registrado: decidir se entra antes do próximo build.

## 5. Pendências

- Confirmar se a 1.1.0 foi gerada e enviada à App Store.
- Decidir a alteração não commitada em `app.json`.
- Lote 1: uma tarefa ficou aberta, pendência de segurança, ver `513418d`. Status atual: não determinado pelos arquivos.
- Terminologia: faltam "Locatário" e "Transação" na padronização (`c183a38`; ainda aparecem em `screens/`, `components/` ou `App.js`).
- IAP só no iOS (`lib/iapService.js:251`), enquanto os Termos citam também o Google Play (`screens/TermsOfServiceScreen.js:78`).
- `supabase/functions/_shared/appleSubscription.ts` ficou órfão após a migração (`311cf2e`) e segue no repo.
- Máscara de telefone duplicada em EditProfile, AddTenant e EditTenant; migrar para `lib/formatters.js` (`547b99d`).
- O plano de lotes citado nos commits não está no repo: lotes restantes não determinados pelos arquivos.
- Não há TODO, FIXME, HACK ou XXX no código (busca de 2026-11-04) nem checklists abertos em `docs/`.
