import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../theme';

const ScreenHeader = ({ title, onBack }) => {
  // O topo seguro varia por aparelho: 20pt num iPhone SE, 59pt num com Dynamic
  // Island. O `paddingTop: 50` fixo que estava aqui espremia o título contra a
  // ilha nos modelos novos e sobrava espaço nos antigos.
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.headerContainer,
        !onBack && styles.headerContainerNoBack,
        { paddingTop: insets.top + 15 },
      ]}
    >
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back-ios" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      ) : null}
      <Text style={[styles.header, !onBack && styles.headerNoBack]}>{title}</Text>
      {onBack ? <View style={{ width: 24 }} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerContainerNoBack: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  backButton: {
    padding: 5,
  },
  header: {
    ...typography.screenTitle,
    textAlign: 'left',
    flex: 1,
  },
  headerNoBack: {
    flex: 0,
  },
});

export default ScreenHeader;



