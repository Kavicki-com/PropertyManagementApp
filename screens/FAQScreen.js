// screens/FAQScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { colors, typography, radii } from '../theme';

const FAQItem = ({ question, answer }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.faqItem}>
      <TouchableOpacity
        style={styles.faqQuestion}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.faqQuestionText}>{question}</Text>
        <MaterialIcons
          name={expanded ? 'expand-less' : 'expand-more'}
          size={24}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.faqAnswer}>
          <Text style={styles.faqAnswerText}>{answer}</Text>
        </View>
      )}
    </View>
  );
};

const FAQScreen = ({ navigation }) => {
  const faqs = [
    {
      category: 'Cadastro e Conta',
      items: [
        {
          question: 'Como faço para me cadastrar no aplicativo?',
          answer: 'Para se cadastrar, clique em "Cadastre-se" na tela de login. Você precisará fornecer seus dados pessoais completos, incluindo CPF, RG, telefone e escolher o tipo de conta (Pessoa, Empresa ou Assessoria). É necessário aceitar os Termos de Uso para concluir o cadastro.',
        },
        {
          question: 'Quais tipos de conta estão disponíveis?',
          answer: 'O aplicativo oferece três tipos de conta: Pessoa (para proprietários individuais), Empresa (para empresas que gerenciam propriedades) e Assessoria (para empresas de assessoria imobiliária que gerenciam propriedades de terceiros).',
        },
        {
          question: 'Posso alterar meus dados após o cadastro?',
          answer: 'Sim, você pode editar seus dados acessando a tela de Configurações e selecionando "Editar perfil". Lá você poderá atualizar suas informações pessoais, exceto o email que requer confirmação.',
        },
        {
          question: 'Esqueci minha senha. Como recuperar?',
          answer: 'Na tela de login, clique em "Esqueceu a senha?". Você receberá um email com instruções para redefinir sua senha. Siga o link enviado para criar uma nova senha.',
        },
      ],
    },
    {
      category: 'Gerenciamento de Imóveis',
      items: [
        {
          question: 'Como adicionar um novo imóvel?',
          answer: 'Acesse a aba "Imóveis" e clique no botão "+" ou "Adicionar Imóvel". Preencha as informações do imóvel, incluindo endereço, tipo, valor do aluguel e fotos. Todos os campos obrigatórios devem ser preenchidos.',
        },
        {
          question: 'Posso adicionar fotos dos imóveis?',
          answer: 'Sim, ao adicionar ou editar um imóvel, você pode tirar fotos com a câmera ou selecionar imagens da galeria. As fotos ajudam a visualizar melhor os imóveis cadastrados.',
        },
        {
          question: 'Como editar informações de um imóvel?',
          answer: 'Na lista de imóveis, toque no imóvel desejado para ver os detalhes. Na tela de detalhes, clique no botão de editar para modificar as informações do imóvel.',
        },
      ],
    },
    {
      category: 'Gerenciamento de Inquilinos',
      items: [
        {
          question: 'Como adicionar um novo inquilino?',
          answer: 'Acesse a aba "Inquilinos" e clique no botão "+" ou "Adicionar Inquilino". Preencha todos os dados do inquilino, incluindo nome completo, CPF, RG, telefone, email e outras informações solicitadas.',
        },
        {
          question: 'Posso vincular um inquilino a um imóvel?',
          answer: 'Sim, você pode vincular um inquilino a um imóvel através da tela de detalhes do imóvel ou do inquilino. Isso facilita o gerenciamento de contratos e pagamentos.',
        },
        {
          question: 'Como visualizar o histórico de um inquilino?',
          answer: 'Na lista de inquilinos, toque no inquilino desejado para ver todos os detalhes, incluindo contratos associados, histórico de pagamentos e informações de contato.',
        },
      ],
    },
    {
      category: 'Contratos e Finanças',
      items: [
        {
          question: 'Como criar um contrato de locação?',
          answer: 'Acesse a tela de detalhes de um imóvel ou inquilino e clique em "Adicionar Contrato". Preencha as informações do contrato, incluindo data de início, data de término, valor do aluguel e dia de vencimento.',
        },
        {
          question: 'Como registrar um pagamento?',
          answer: 'Na aba "Finanças", clique em "Adicionar Transação". Selecione o tipo (Receita ou Despesa), o imóvel relacionado (se aplicável) e preencha o valor e a data da transação.',
        },
        {
          question: 'Posso visualizar relatórios financeiros?',
          answer: 'Sim, na aba "Finanças" você pode visualizar um resumo das suas receitas e despesas. Use o filtro de data para visualizar períodos específicos.',
        },
      ],
    },
    {
      category: 'Geral',
      items: [
        {
          question: 'O aplicativo funciona offline?',
          answer: 'O aplicativo requer conexão com a internet para funcionar, pois os dados são armazenados na nuvem para garantir sincronização e backup automático.',
        },
        {
          question: 'Meus dados estão seguros?',
          answer: 'Sim, utilizamos medidas de segurança avançadas para proteger seus dados. Todas as informações são criptografadas e armazenadas de forma segura. Recomendamos que você mantenha sua senha em sigilo.',
        },
        {
          question: 'Como entrar em contato com o suporte?',
          answer: 'Você pode entrar em contato através dos canais de suporte disponíveis no aplicativo. Acesse a tela de Configurações para mais informações sobre contato.',
        },
        {
          question: 'O aplicativo é gratuito?',
          answer: 'Consulte as informações sobre planos e preços na tela de Configurações ou entre em contato com o suporte para mais detalhes sobre os planos disponíveis.',
        },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader title="Perguntas Frequentes" onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
      >
        {faqs.map((category, categoryIndex) => (
          <View key={categoryIndex} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{category.category}</Text>
            {category.items.map((faq, index) => (
              <FAQItem
                key={index}
                question={faq.question}
                answer={faq.answer}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    ...typography.sectionTitle,
    marginBottom: 16,
    fontSize: 18,
  },
  faqItem: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestionText: {
    ...typography.bodyStrong,
    flex: 1,
    marginRight: 12,
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  faqAnswerText: {
    ...typography.body,
    lineHeight: 22,
    marginTop: 12,
  },
});

export default FAQScreen;

