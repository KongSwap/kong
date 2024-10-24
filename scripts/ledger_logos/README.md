To add logos to a ledger canister

1) save logo.png or logo.svg file
2) python3 -mbase64 logo.png | tr -d '\n' > logo.uue
3) copy the base64 encoded image into the string below

vec {
 record {
      \"icrc1:logo\";
      variant {
        Text = \"data:image/svg+xml;base64,2ZyB3...mc+Cg==\"
      };
    };
},