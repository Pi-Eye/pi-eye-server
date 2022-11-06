# Pi Eye Server

## About

Server side code of Pi-Eye

### Built With

* Express
* NodeJS
* TypeScript

## Getting Started

### Prerequisites

1. An OpenCL 1.2 compatible device ([compatability list](https://www.khronos.org/conformance/adopters/conformant-products/opencl))

2. [vcpkg](https://vcpkg.io/en/index.html)

3. [Node](https://nodejs.org/) and npm

### Installation

1. Install dependencies
    ```sh
    vcpkg install opencl libjpeg-turbo freetype
    ```

2. Set CMAKE toolchain file

    Linux/MacOS:
      ```sh
      export CMAKE_TOOLCHAIN_FILE="[path to vcpkg]/scripts/buildsystems/vcpkg.cmake"
      ```
    Windows (Powershell):
      ```sh
      $ENV:CMAKE_TOOLCHAIN_FILE="[path to vcpkg]/scripts/buildsystems/vcpkg.cmake"
      ```

4. Clone repository
    ```sh
    git clone https://github.com/Pi-Eye/pi-eye-server

3. Install NPM package (this may take a long time)
    ```sh
    npm install
    ```

## Usage

1. Make a copy of `test.env` and save as `.env`

2. Open `.env` and fill out environment variables, comments in file

3. Start server with npm by running:
    ```sh
    npm start
    ```

## License

Distributed uner the GPL-3.0 License. See `LICENSE.txt` for more information.

## Contact

Bennett Wu - bwu1324@gmail.com