// screens/TermsOfServiceScreen.js
import React from 'react';
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

const TermsOfServiceScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <ScreenHeader title="Termos de Uso" onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.lastUpdated}>
          Última atualização: {new Date().toLocaleDateString('pt-BR')}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Aceitação dos Termos</Text>
          <Text style={styles.text}>
            Ao acessar e usar este aplicativo de gestão de propriedades, você concorda em cumprir e estar vinculado aos seguintes termos e condições de uso. Se você não concorda com alguma parte destes termos, não deve utilizar o aplicativo.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Descrição do Serviço</Text>
          <Text style={styles.text}>
            Este aplicativo fornece uma plataforma para gestão de propriedades, permitindo que proprietários gerenciem imóveis, inquilinos, contratos de locação e finanças relacionadas. O serviço é fornecido "como está" e pode ser modificado ou descontinuado a qualquer momento.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Cadastro e Conta do Usuário</Text>
          <Text style={styles.text}>
            Para utilizar o aplicativo, você deve criar uma conta fornecendo informações precisas e completas. Você é responsável por manter a confidencialidade de suas credenciais de acesso e por todas as atividades que ocorrem sob sua conta. Você concorda em notificar imediatamente sobre qualquer uso não autorizado de sua conta.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Uso Aceitável</Text>
          <Text style={styles.text}>
            Você concorda em usar o aplicativo apenas para fins legais e de acordo com estes termos. Você não deve:
          </Text>
          <Text style={styles.bulletPoint}>
            • Usar o aplicativo de forma que viole qualquer lei ou regulamento
          </Text>
          <Text style={styles.bulletPoint}>
            • Tentar acessar áreas não autorizadas do aplicativo
          </Text>
          <Text style={styles.bulletPoint}>
            • Interferir ou interromper o funcionamento do aplicativo
          </Text>
          <Text style={styles.bulletPoint}>
            • Transmitir vírus ou código malicioso
          </Text>
          <Text style={styles.bulletPoint}>
            • Coletar informações de outros usuários sem autorização
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Dados e Privacidade</Text>
          <Text style={styles.text}>
            Você é responsável por todos os dados que inserir no aplicativo. Nós nos comprometemos a proteger sua privacidade e processar seus dados pessoais de acordo com nossa Política de Privacidade. Ao usar o aplicativo, você consente com a coleta e uso de suas informações conforme descrito na Política de Privacidade.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Propriedade Intelectual</Text>
          <Text style={styles.text}>
            Todo o conteúdo do aplicativo, incluindo textos, gráficos, logos, ícones e software, é propriedade do aplicativo ou de seus fornecedores de conteúdo e está protegido por leis de direitos autorais e outras leis de propriedade intelectual.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Limitação de Responsabilidade</Text>
          <Text style={styles.text}>
            O aplicativo é fornecido "como está" sem garantias de qualquer tipo. Não garantimos que o aplicativo será ininterrupto, seguro ou livre de erros. Em nenhuma circunstância seremos responsáveis por quaisquer danos diretos, indiretos, incidentais ou consequenciais resultantes do uso ou incapacidade de usar o aplicativo.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Modificações dos Termos</Text>
          <Text style={styles.text}>
            Reservamo-nos o direito de modificar estes termos a qualquer momento. As alterações entrarão em vigor imediatamente após a publicação. É sua responsabilidade revisar periodicamente estes termos. O uso continuado do aplicativo após as alterações constitui aceitação dos novos termos.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Rescisão</Text>
          <Text style={styles.text}>
            Podemos encerrar ou suspender sua conta e acesso ao aplicativo imediatamente, sem aviso prévio, por qualquer motivo, incluindo violação destes termos. Após a rescisão, seu direito de usar o aplicativo cessará imediatamente.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Lei Aplicável</Text>
          <Text style={styles.text}>
            Estes termos são regidos pelas leis do Brasil. Qualquer disputa relacionada a estes termos será resolvida nos tribunais competentes do Brasil.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Contato</Text>
          <Text style={styles.text}>
            Se você tiver dúvidas sobre estes termos, entre em contato conosco através dos canais de suporte disponíveis no aplicativo.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Ao continuar, você confirma que leu, entendeu e concorda com estes Termos de Uso.
          </Text>
        </View>
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
    padding: 20,
    paddingBottom: 32,
  },
  lastUpdated: {
    ...typography.caption,
    marginBottom: 20,
    textAlign: 'center',
    color: colors.textMuted,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    marginBottom: 12,
    fontSize: 16,
  },
  text: {
    ...typography.body,
    marginBottom: 12,
    lineHeight: 22,
  },
  bulletPoint: {
    ...typography.body,
    marginLeft: 16,
    marginBottom: 8,
    lineHeight: 22,
  },
  footer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    marginBottom: 20,
  },
  footerText: {
    ...typography.bodyStrong,
    textAlign: 'center',
    color: colors.primary,
  },
});

export default TermsOfServiceScreen;

