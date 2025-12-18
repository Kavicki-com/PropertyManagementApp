import React, { useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Text, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { radii } from '../theme';

const CustomDatePicker = ({ date, onDateChange, visible, onClose }) => {
  // For iOS, we need a temporary state to hold the date until the user confirms
  const [tempDate, setTempDate] = useState(date);

  const handleConfirm = () => {
    onDateChange(null, tempDate); // Pass the selected date back
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  if (!visible) {
    return null;
  }

  // Android uses its native modal, which is handled directly by the component
  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={date}
        mode="date"
        display="default"
        onChange={onDateChange}
      />
    );
  }

  // iOS is wrapped in a custom modal for a better user experience
  return (
    <Modal
      transparent={true}
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.modalOverlay} onPress={handleCancel} activeOpacity={1}>
        <View style={styles.modalContainer}>
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="spinner" // 'spinner' is the wheel style for iOS
            onChange={(event, selectedDate) => setTempDate(selectedDate || tempDate)}
            textColor="black"
          />
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={handleCancel}>
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={handleConfirm}>
              <Text style={[styles.buttonText, styles.confirmButtonText]}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
  },
  confirmButton: {
    backgroundColor: '#4a86e8',
    marginLeft: 10,
  },
  buttonText: {
    fontSize: 16,
    color: '#4a86e8',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default CustomDatePicker;

