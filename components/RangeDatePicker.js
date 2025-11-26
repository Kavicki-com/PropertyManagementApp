import React, { useMemo, useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Calendar } from 'react-native-calendars';

// Componente para seleção de intervalo de datas em estilo calendário
// Props:
// - visible: boolean
// - startDate: string (yyyy-mm-dd) | null
// - endDate: string (yyyy-mm-dd) | null
// - onConfirm: (start: string | null, end: string | null) => void
// - onClose: () => void
const RangeDatePicker = ({ visible, startDate, endDate, onConfirm, onClose }) => {
  const [rangeStart, setRangeStart] = useState(startDate);
  const [rangeEnd, setRangeEnd] = useState(endDate);

  useEffect(() => {
    setRangeStart(startDate || null);
    setRangeEnd(endDate || null);
  }, [startDate, endDate, visible]);

  const onDayPress = (day) => {
    const date = day.dateString;

    // Se ainda não há início ou já havia um intervalo completo, recomeça pelo início
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(date);
      setRangeEnd(null);
      return;
    }

    // Se a nova data é anterior ao início, redefinimos o início
    if (date < rangeStart) {
      setRangeStart(date);
      setRangeEnd(null);
      return;
    }

    // Define o fim do intervalo
    setRangeEnd(date);
  };

  const markedDates = useMemo(() => {
    if (!rangeStart) return {};

    const PRIMARY_COLOR = '#4a86e8';
    const RANGE_COLOR = '#e3f2fd'; // mesmo tom azul claro dos botões "Ver imóvel"

    const marks = {};

    if (!rangeEnd || rangeEnd === rangeStart) {
      marks[rangeStart] = {
        startingDay: true,
        endingDay: true,
        color: PRIMARY_COLOR,
        textColor: '#fff',
      };
      return marks;
    }

    // Marca todos os dias entre início e fim
    let current = rangeStart;
    while (current <= rangeEnd) {
      const isStart = current === rangeStart;
      const isEnd = current === rangeEnd;

      marks[current] = {
        startingDay: isStart,
        endingDay: isEnd,
        color: isStart || isEnd ? PRIMARY_COLOR : RANGE_COLOR,
        textColor: isStart || isEnd ? '#fff' : '#333',
      };

      const dateObj = new Date(current);
      dateObj.setDate(dateObj.getDate() + 1);
      current = dateObj.toISOString().split('T')[0];
    }

    return marks;
  }, [rangeStart, rangeEnd]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Selecionar período</Text>
          <Calendar
            markingType="period"
            markedDates={markedDates}
            onDayPress={onDayPress}
          />
          <View style={styles.footer}>
            <TouchableOpacity style={styles.footerButton} onPress={onClose}>
              <Text style={styles.footerButtonTextSecondary}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerButton, styles.footerButtonPrimary]}
              onPress={() => {
                onConfirm(rangeStart || null, rangeEnd || rangeStart || null);
                onClose();
              }}
            >
              <Text style={styles.footerButtonTextPrimary}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    elevation: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
    color: '#333',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 8,
  },
  footerButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  footerButtonPrimary: {
    marginLeft: 4,
  },
  footerButtonTextSecondary: {
    color: '#666',
    fontSize: 14,
  },
  footerButtonTextPrimary: {
    color: '#4a86e8',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default RangeDatePicker;


