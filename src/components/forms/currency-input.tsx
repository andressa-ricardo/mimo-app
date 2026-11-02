import { TextField, type TextFieldProps } from '@/components/forms/text-field';
import { centsFromDigits, formatCentsAmount } from '@/utils/money';

type CurrencyInputProps = Omit<TextFieldProps, 'keyboardType' | 'onChange' | 'onChangeText' | 'value'> & {
  onChange: (cents: number | null) => void;
  value: number | null;
};

/** BRL mask that works on integer cents: typing 1, 2, 3, 4 shows "12,34". */
export function CurrencyInput({ onChange, placeholder = '0,00', value, ...props }: CurrencyInputProps) {
  return (
    <TextField
      inputMode="numeric"
      keyboardType="number-pad"
      maxLength={16}
      onChangeText={(text) => onChange(centsFromDigits(text))}
      placeholder={placeholder}
      value={value === null ? '' : formatCentsAmount(value)}
      {...props}
    />
  );
}
