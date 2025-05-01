build:
	cd ../../; \
	dfx canister create --all; \
	dfx build ic_siws_provider; \
	cd target/wasm32-unknown-unknown/release/; \
	ic-wasm ic_siws_provider.wasm -o ic_siws_provider.wasm metadata candid:service -f ../../../packages/ic_siws_provider/ic_siws_provider.did -v public; \
	gzip --no-name --force "ic_siws_provider.wasm"; \
	cp ic_siws_provider.wasm.gz ../../../packages/ic_siws_provider/; \

test:
	@{ \
	  make -f ../test_canister/Makefile build; \
		export POCKET_IC_BIN=../../pocket-ic; \
		export IC_SIWS_PROVIDER_PATH=../../target/wasm32-unknown-unknown/release/ic_siws_provider.wasm.gz; \
		export TEST_CANISTER_PATH=../../target/wasm32-unknown-unknown/release/test_canister.wasm.gz; \
		$(MAKE) build; \
		cargo test --test integration_tests $(if $(TEST_NAME),-- $(TEST_NAME) --nocapture,-- --nocapture); \
	}
	
clean:
	cargo clean