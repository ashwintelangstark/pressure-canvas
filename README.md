# Pressure Canvas

const int rows = 20;

const int cols = 20;




// Array to hold the 20x20 pressure readings

int pressureMap[rows][cols];




// Shared MUX binary addressing pins (S0, S1, S2, S3)

const int muxSelectPins[4] = {25, 26, 27, 14};




// Row Multiplexer Enable Pins (Active LOW for CD74HC4067)

const int rowMux1_EN = 32; // Handles rows 0-15

const int rowMux2_EN = 33; // Handles rows 16-19




// Column Multiplexer Signal/Analog Read Pins

const int colMux1_SIG = 34; // Handles columns 0-15 (Analog Input)

const int colMux2_SIG = 35; // Handles columns 16-19 (Analog Input)




void setup() {

Serial.begin(115200);




  // Force ESP32 to 10-bit mode (Outputs 0 - 1023 instead of 0 - 4095)

  // This matches standard Arduino mapping behavior

analogReadResolution(10);




  // Initialize MUX select pins

for (int i = 0; i < 4; i++) {

pinMode(muxSelectPins[i], OUTPUT);

digitalWrite(muxSelectPins[i], LOW);

  }




  // Initialize Row MUX Enable pins

pinMode(rowMux1_EN, OUTPUT);

pinMode(rowMux2_EN, OUTPUT);




  // Disable both row multiplexers initially (Active HIGH to disable)

digitalWrite(rowMux1_EN, HIGH);

digitalWrite(rowMux2_EN, HIGH);




  // Configure Column SIG pins as inputs

pinMode(colMux1_SIG, INPUT);

pinMode(colMux2_SIG, INPUT);




  // MINOR CHANGE: brief settle time before the first scan so the

  // receiving app (Flask/pyserial) doesn't catch a half-open port mid-frame.

delay(200);

}




void loop() {

for (int r = 0; r < rows; r++) {

activateRow(r);




for (int c = 0; c < cols; c++) {

pressureMap[r][c] = readColumn(c);

    }




deactivateRow(r);

  }




printMatrix();




  // MINOR CHANGE: reduced from 2000ms to 500ms so the web dashboard's

  // heatmap updates feel closer to real time. The 300ms poll interval on

  // the Flask front end will pick up whichever is the latest full frame.

delay(500);

}




// Selects channel via S0-S3 lines

void setMuxAddress(int channel) {

int bitAddress = channel % 16; // Wrap around for 16-channel MUX limits

for (int i = 0; i < 4; i++) {

digitalWrite(muxSelectPins[i], (bitAddress >> i) & 0x01);

  }

}




void activateRow(int r) {

setMuxAddress(r);




if (r < 16) {

digitalWrite(rowMux1_EN, LOW);  // Enable MUX 1 (Active LOW)

digitalWrite(rowMux2_EN, HIGH); // Disable MUX 2

  } else {

digitalWrite(rowMux1_EN, HIGH); // Disable MUX 1

digitalWrite(rowMux2_EN, LOW);  // Enable MUX 2 (Active LOW)

  }




  // CRITICAL FIX: Give the internal MUX switches time to stabilize

  // before starting column readings across the new row

delayMicroseconds(50);

}




void deactivateRow(int r) {

  // Disable both row multiplexers to prevent cross-talk during channel switches

digitalWrite(rowMux1_EN, HIGH);

digitalWrite(rowMux2_EN, HIGH);

delayMicroseconds(10);

}




int readColumn(int c) {

setMuxAddress(c);




  // CRITICAL FIX: Extended settling delay for ESP32 ADC capacitor.

  // This stops adjacent columns from bleeding "ghost" data into each other.

delayMicroseconds(2000);




if (c < 16) {

return analogRead(colMux1_SIG);

  } else {

return analogRead(colMux2_SIG);

  }

}




void printMatrix() {

for (int r = 0; r < rows; r++) {

for (int c = 0; c < cols; c++) {

Serial.print(pressureMap[r][c]);

if (c < cols - 1) Serial.print(",");

    }

Serial.println();

  }

Serial.println(); // Blank separator frame line

}

for this code make a web application to read the pressure from 20x20 matrix pressure sensor mat and plot the heatmap accoring to the readings. make ascetic web app for this. keep it simple. stick to the esp-32 firmware.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/afcb1810-5f48-467e-bb73-70eae5b95d1a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
