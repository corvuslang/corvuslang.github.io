all: api.js corvus_js.wasm

api.js: ../corvus_js/api.js
	cp ../corvus_js/api.js api.js

corvus_js.wasm: ../corvus_js/api.js ../corvus_js/src/*.rs
	cd ../corvus_js && cargo-web build --release && \
	cd .. && cp target/wasm32-unknown-unknown/release/corvus_js.{wasm,js} corvuslang.github.io

