import * as React from "react";
import { Input } from "./input";

interface DateInputProps extends Omit<React.ComponentProps<"input">, "type"> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function DateInput({ value, onChange, ...props }: DateInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Validate the date format (YYYY-MM-DD)
    if (inputValue) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(inputValue)) {
        // If format is invalid, don't update
        return;
      }
      
      // Ensure year is exactly 4 digits (between 1000-9999)
      const year = parseInt(inputValue.split("-")[0]);
      if (year < 1000 || year > 9999) {
        return;
      }
      
      // Validate that it's a valid date
      const date = new Date(inputValue);
      if (isNaN(date.getTime())) {
        return;
      }
    }
    
    if (onChange) {
      onChange(e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.target as HTMLInputElement;
    
    // Allow navigation keys, backspace, delete, tab
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (allowedKeys.includes(e.key)) {
      return;
    }
    
    // For number keys, check if we're in the year part and limit to 4 digits
    if (/^\d$/.test(e.key)) {
      const cursorPos = input.selectionStart || 0;
      const currentValue = input.value;
      
      // If the input is complete (10 characters for YYYY-MM-DD), prevent further input
      if (currentValue.length >= 10 && input.selectionStart === input.selectionEnd) {
        e.preventDefault();
      }
    }
  };

  return (
    <Input
      type="date"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

export { DateInput };
