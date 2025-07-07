#!/usr/bin/env bash

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

TOKEN_SYMBOL="ICP"
TOKEN_LEDGER=$(echo ${TOKEN_SYMBOL}_ledger | tr '[:upper:]' '[:lower:]')
TOKEN_NAME="Internet Computer (KongSwap Test Token)"
TRANSFER_FEE=10_000
TOKEN_LOGO="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAsWSURBVGhD1ZoLcFTVGcf/9+57N7t5kZAXkEDAECEGeQg6KioKviql2KlahIqjDNRqR9upVNswrY9OZ8RpI5U6Cop1WkcUHCkCCohgACmk2DwQYhLyDpvNZpN9797T79x7d7ub3UDIBKW/mTPnnLtn737/833nnO/eRMAowBhLo2oxlauoFFIpp8Kv8RKhSS3VavlMEATe/27gRlOpoLKPykg5QWU5FS7624F+LGJ4L5XRZBOVSyuEfuBSGD6YCvXnRg+6aSEV7u5vi0Yqo+MNutEKKpd61pPBf5NvDCOHbsBD5rtmZCHFv6h8/7Lg4kTQFxYr37usWK6aF0fCQUYD+eI5QSX2ELoccFKZMfjwSyagkapv72C5OKpJwAy1LSOqtQwZz2PtcjWeU042/lZty0Q9oIYOn/3LHR5KReQJXsd5IE7ZZQxfm48rTdUD/0ezHyHqhYiAFVRt4u2h+LTdg21NHtQ5g2j3hORrJWl6LJucgjlZBuSbtfK14cI8Lvh3bka47gjY2XpIbhcEixXaafOgm70A2nnfV0cOSQUJWBcRwLdNnsMncPScD2u/dJDRYfVKInkWDR4stuLByVb1yvnxbf0Tgh9vJhH96hWCLBF0IgQ9RbVBgCanALrb10A74x51QAL7ScBNwvnCp7K2DxtqXWrvwswmTzw/O2NIb0jnWuFdvxrh5jr1ioIgkvVaAYKBjCcBvBZIBBeju2UVtNetUkcmkM4FJA0fbvyrx+1IaeyCta4FKY5+6MCQZjOCLZiOpoKxaFNDKRbujTdvzE4QEW6uheel1WD2NvWKCtmumVgKMTUVUvcpUumJEwBq6657BJrZj6hfiGMFF7CeGk8ofYU2dwiLN1Qjd+shGJ1uGBhDfn4qHnrxbkyZM0EdBVoTbrxCHhosZLAI2fjf/zg+ZAht6TUwLnsG4vgS9QoQOr4doYMbKc46yRuKV3jR3fkXCGOvVkdFeZkL2EeN+Upf4enXT+DrP+6Ehto03yguGYuntiyD2WpQBsTgCkqyiC2n442LiMh1d8K99nsJxpvIcN2ipOkNmK8fga2P0s3PKJ4gAWL+TGjmV6ojomzj50Dcydvd1oea1w6oxgP5ealY88q9SY3n2GjhPX1VGtaU2tQrCu3uMJZ/1o2G9U/FGS+YbbA8/+GQxnMEoxX6pRshWG1RDzBnNd2nQx0RpTxBQM3RZhh7B2CksDExCdMoZDIpfC7EmlISmkTEqpIn0a9LkfvcePMzb0MzYarcPx+CwQrNVT9SBNAk8bXCOj5XP42SxgXE0VLXBRPVJlkAMHdJmfLBMEgmosOcg9XXvySLMK76w7CMjyBmXgHoBApiMoRgrtNyHUOigGC/TxFAX+LxnzDgAnARj7p61J7C6dRi/PnuSuhmLlCvDBO94rkoio44uH1yUhTBlmJQZp/avA65fMoHw8T3xiEsW/cu7viStsQYPmTjsfaYQ+2NDEGfeFAmCCicmiPPvLwGqN9+ZPgvzwLvHYdn3Q65vfbvezGjoV1uR+DbbuVFHIzS2X+qLQXBNlltRWniAvhrvijTF0xRQ0gpzVtPYKA1TmNS/GT8wJPvqT2FF/ccpnxJp/YUNtAB+cK/e9Xe0PAdh7XsVHs0kSwL7WNuU3tRZAFxU2ykk3bKnPHqIqY10OfDgfs3wXseEZ71n8A9yHhNQTryNz+IzUlO5S2nB7Dkk67/HYA8VAM+PPTASswuvxnTS69H2awfYt6zwEo603qDJuwveJbuwzf3OKqTphKuNie23fUqRIp/eTHT4kkvSMPkn81Hxm1ToSGRnGDVN/C+/ClCh+NTKZGMt/3jYbnmtNF2uoLOhMEn9hipF0tCdajdvQ+tvQyNDd/A4/Hh4blMzvNfO0yZBE8nssfjxokWPLb8TpRdMw8wZyk3UFMJ/oCQ4NP6zYdR87ud0bXAa742uCBrfhp05Bmdy6sMjoHPvDXG+Aj8xOYi6ikd50i9dujqj0J38nN4zjbDHQBuL2GYlMkwq8gILw071uiDQEo2fSnCSE68uqwYP7lvIW697UYgJZffpkhUH832814sJSvmooxmXF4LqghZiEQ5TEtvgvF0H+jmTYRt52MJxnP4if3+ghz5nOAzz43vrToIV0MzsmmZlGST5yQJwRBDRx8VF0MgzGRhpVkS/OS8vUca8Po7u7F7F5k70FFDv9kkB1VFRQU/jePyIU7m3CLk/aAcnj11ssGyEJoRvfo5N1quKaRMv1oIy3OL6eRMnkpHmJNlhFh3ANUf74GzsRkpNLzAzGA2AydaGc706uANi2gjEQcbRXxFG9nEdAkOj0iCBDS1O9Db44DJ3bjjnR37t8sWqGHEA3nId0FeivPQ7lqwmg5IrUrEaa/MhfaaIhjunSmLGBY0CT99eDU+OfgfuP0CzBoKST2j84d+g8JGYyCBesq7aBwL+BEO+mEikWG/CDs5vS9IYmkGJ4zRH99TtXemMoUEieAP9aP/ansQfLe5597Hcby6DnkUkzPSGa7Nl3D/QoZ6uwa/3iGSJ5SxY8gzt0wKoWKRhMpdRtR2MpxySWjzUoYqsCNv3y/dHCvggl4YDZYuXYmTtS3od/uQmZYKm9kIiy6AF355B2pbaZ3sOoGaU43IHjsWs64up8Ur4bM9H8HhCiEnOxv9Xj86HX1IM7GBRSXSUX4OyKiL+WWld+k483UjfD4lPWGiBgFK3E93DuA3Gw6g3+NEYVEBiibkISPNDJPoQaqvDvqMifAJevhobFhQzgIKN/OxFqE0KoBDItZRFXcyjzbhUJB7W2573B44+/oganSwZhbC5TOgpbULYdrp3B4/6s+cRdiYg7KyaTAajXA6XXC73fJ3QxJEh0dOtBPg7zMunDuMGB61vDBIAS+Y3wuDwQA9Ld6vvrajpc1OH2uh1RlhdwVwxmGEq89FAsywMD+0IT9f31ESBPC9laqfK73Rx6DX0m8obX7IWo16aDR6VFUdQVPTWdhSbcjNy8W4cQXIoXXQ3tmNL+gzvcGMglQTUtU9nHYmaUoWCybzABexmapLsiNNvaKQ9ny+5QrwSwJCoh6WFCu8ngHMpEU7edIk5OfmkfHZKMjPRWnJJHh9Hmi0tJdqNGAknk9ApgXeJ25g9UkFcNT1MOoi3nizEpOKi+Q2ZRfocfWj5ew3EEURFgvN8rh82NLo0dNiQRbtOmaTCZQukEA39CzI33nJtDhRU5SBu4YUwFFFjOqa0BlMmJAuwEYZYjqFQw7lJpIURohWbsDfT/EdQld3j1z8/gDO2e1IIWHO3nPoHfDCH6a0xMAwZQyk8enwqHrOD+0aPNXgr1/iXgCMlJP7PsSLGz7AoWMN0AgMcpJKszyBZj9jTDY0OhMkEuT3DsDhsKOnpwfF5iD6KS+y+4GMFHbyvhnslV9sOfTX83ogAl/YVLjfRyWkeEq8dMlClE0vphkVYKUH90ILPbS0taPb7qSYD8BHs++gbbO7qwsmyUdbK6OMlk5ZC6ueNY699dRN7CN+r2F5IBbVGzzt4M8RI8Z5rhOf7tmHD97fhdN1DXKSSGkOkJqHsM7CX5VS/uNBe0cbLBoJJoNIWytOlueztzYulbYKK6vkB7GLFhBBFcIzWP7HhqRvti9If3vV3u3v2p+r3JZzqjMs3ZqLK0/1wdzhg2ikA9dKW+VAEN6+EGp4zN9ZyjbxmRce+iL6sD1iAbHEiOH/bsPF8H7seuGbAC/8lOczx+vtFJby5sDeuFb4279gqjwkHPAEhGkU/rRMKdsVWSDVwGoevRY3PDATbjI85gjjAP8F5g3tz/oFArcAAAAASUVORK5CYII="

if [ "$1" == "staging" ]; then
	bash create_canister_id.sh staging
	SPECIFIED_ID=""
elif [ "$1" == "local" ]; then
	# Source .env file to get canister IDs
	if [ -f "${PROJECT_ROOT}/.env" ]; then
		. "${PROJECT_ROOT}/.env"
		if [ ! -z "${CANISTER_ID_ICP_LEDGER}" ]; then
			SPECIFIED_ID="--specified-id ${CANISTER_ID_ICP_LEDGER}"
		else
			echo "Warning: CANISTER_ID_ICP_LEDGER not found in .env"
		fi
	else
		echo "Error: .env file not found"
		exit 1
	fi
else
	exit 1
fi
NETWORK="--network $1"
IDENTITY="--identity kong_token_minter"
MINTER_ACCOUNT_ID=$(dfx ledger $NETWORK $IDENTITY account-id)

dfx deploy ${NETWORK} ${IDENTITY} ${TOKEN_LEDGER} ${SPECIFIED_ID} --argument "(variant { Init =
	record {
		minting_account = \"$MINTER_ACCOUNT_ID\";
		initial_values = vec {};
		send_whitelist = vec {};
		transfer_fee = opt record {
			e8s = ${TRANSFER_FEE} : nat64;
		};
		token_symbol = opt \"$TOKEN_SYMBOL\";
		token_name = opt \"$TOKEN_NAME\";
		metadata = vec { record { \"icrc1:logo\"; variant { Text = \"${TOKEN_LOGO}\" }; }; };
	}
})"
