/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/debt_bonds.json`.
 */
export type DebtBonds = {
  "address": "FvpkHjRckVSJiBurrxj3gkJAK67jivvGfffvs9Xn7rnm",
  "metadata": {
    "name": "debtBonds",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Debt Bonds Anchor program"
  },
  "instructions": [
    {
      "name": "addSupplyToListing",
      "docs": [
        "Issuer mints `amount` new bond tokens straight into the escrow,",
        "increasing the available-to-purchase supply."
      ],
      "discriminator": [
        95,
        240,
        155,
        204,
        30,
        128,
        155,
        59
      ],
      "accounts": [
        {
          "name": "issuer",
          "signer": true,
          "relations": [
            "bondConfig"
          ]
        },
        {
          "name": "bondMint",
          "writable": true
        },
        {
          "name": "bondConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  110,
                  100,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "bondMint"
              }
            ]
          }
        },
        {
          "name": "listing",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "bondMint"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "bondMint"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "closeListing",
      "docs": [
        "Terminal close. Available bonds remain in escrow and stop being",
        "purchasable. (Re-opening a closed listing is intentionally",
        "unsupported.)"
      ],
      "discriminator": [
        33,
        15,
        192,
        81,
        78,
        175,
        159,
        97
      ],
      "accounts": [
        {
          "name": "issuer",
          "signer": true,
          "relations": [
            "bondConfig"
          ]
        },
        {
          "name": "bondMint"
        },
        {
          "name": "bondConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  110,
                  100,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "bondMint"
              }
            ]
          }
        },
        {
          "name": "listing",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "bondMint"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "createBond",
      "docs": [
        "Creates a brand-new bond: initializes the SPL mint with decimals=0,",
        "sets `BondConfig` PDA as the mint authority (freeze authority left",
        "unset), and records bond terms."
      ],
      "discriminator": [
        96,
        81,
        70,
        166,
        111,
        33,
        61,
        50
      ],
      "accounts": [
        {
          "name": "issuer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bondMint",
          "writable": true,
          "signer": true
        },
        {
          "name": "bondConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  110,
                  100,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "bondMint"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nominalValue",
          "type": "u64"
        },
        {
          "name": "interestRateBps",
          "type": "u16"
        },
        {
          "name": "durationYears",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initListing",
      "docs": [
        "Opens a single listing for the bond with a given payment coin and",
        "per-bond unit price. Creates the escrow token account that holds",
        "available-to-purchase bonds."
      ],
      "discriminator": [
        163,
        104,
        120,
        177,
        101,
        20,
        250,
        169
      ],
      "accounts": [
        {
          "name": "issuer",
          "writable": true,
          "signer": true,
          "relations": [
            "bondConfig"
          ]
        },
        {
          "name": "bondMint"
        },
        {
          "name": "paymentMint"
        },
        {
          "name": "bondConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  110,
                  100,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "bondMint"
              }
            ]
          }
        },
        {
          "name": "listing",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "bondMint"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "bondMint"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "unitPrice",
          "type": "u64"
        }
      ]
    },
    {
      "name": "payHolderCoupons",
      "docs": [
        "Issuer pays whatever coupon a holder is still owed, in a coin of",
        "the issuer's choosing. The owed amount is computed in abstract",
        "units (`nominal_value * rate_bps / 10_000 * duration_years *",
        "bonds_held - coupons_paid`) and scaled to the chosen payment",
        "mint's decimals. The client calls this once per holder per tx (or",
        "batches several invocations into a single tx)."
      ],
      "discriminator": [
        227,
        150,
        53,
        220,
        191,
        105,
        2,
        213
      ],
      "accounts": [
        {
          "name": "issuer",
          "writable": true,
          "signer": true,
          "relations": [
            "bondConfig"
          ]
        },
        {
          "name": "bondMint"
        },
        {
          "name": "paymentMint"
        },
        {
          "name": "bondConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  110,
                  100,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "bondMint"
              }
            ]
          }
        },
        {
          "name": "holder",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  108,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "bondMint"
              },
              {
                "kind": "account",
                "path": "holder.owner",
                "account": "holder"
              }
            ]
          }
        },
        {
          "name": "issuerPaymentAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "issuer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "paymentMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "holderPaymentAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "holder.owner",
                "account": "holder"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "paymentMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "purchaseBond",
      "docs": [
        "A non-issuer buys `amount` bonds. Pays `amount * unit_price` of the",
        "listing's `payment_mint` directly to the issuer's ATA; receives",
        "`amount` bond tokens out of escrow; updates / creates a `Holder`",
        "PDA tracking how many bonds they hold and how much coupon was paid."
      ],
      "discriminator": [
        68,
        255,
        195,
        198,
        213,
        74,
        108,
        200
      ],
      "accounts": [
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bondMint",
          "writable": true
        },
        {
          "name": "paymentMint"
        },
        {
          "name": "bondConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  110,
                  100,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "bondMint"
              }
            ]
          }
        },
        {
          "name": "listing",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "bondMint"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "bondMint"
              }
            ]
          }
        },
        {
          "name": "holder",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  108,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "bondMint"
              },
              {
                "kind": "account",
                "path": "buyer"
              }
            ]
          }
        },
        {
          "name": "buyerBondAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "buyer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "bondMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "buyerPaymentAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "buyer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "paymentMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "issuer"
        },
        {
          "name": "issuerPaymentAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "issuer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "paymentMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "registerBond",
      "docs": [
        "Migration path for bonds whose SPL mint was created BEFORE this",
        "feature shipped. The current mint authority (the issuer) signs to",
        "hand mint authority over to the `BondConfig` PDA."
      ],
      "discriminator": [
        184,
        38,
        33,
        13,
        111,
        57,
        101,
        74
      ],
      "accounts": [
        {
          "name": "issuer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bondMint",
          "writable": true
        },
        {
          "name": "bondConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  110,
                  100,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "bondMint"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "nominalValue",
          "type": "u64"
        },
        {
          "name": "interestRateBps",
          "type": "u16"
        },
        {
          "name": "durationYears",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "bondConfig",
      "discriminator": [
        142,
        20,
        216,
        1,
        7,
        142,
        247,
        125
      ]
    },
    {
      "name": "holder",
      "discriminator": [
        37,
        121,
        1,
        40,
        55,
        46,
        199,
        157
      ]
    },
    {
      "name": "listing",
      "discriminator": [
        218,
        32,
        50,
        73,
        43,
        134,
        26,
        58
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidNominalValue",
      "msg": "Nominal value must be greater than zero."
    },
    {
      "code": 6001,
      "name": "invalidInterestRate",
      "msg": "Interest rate must be greater than zero."
    },
    {
      "code": 6002,
      "name": "invalidDuration",
      "msg": "Duration must be at least one year."
    },
    {
      "code": 6003,
      "name": "invalidPrice",
      "msg": "Price must be greater than zero."
    },
    {
      "code": 6004,
      "name": "invalidAmount",
      "msg": "Amount must be greater than zero."
    },
    {
      "code": 6005,
      "name": "listingClosed",
      "msg": "Listing is closed."
    },
    {
      "code": 6006,
      "name": "listingNotActive",
      "msg": "Listing is not active."
    },
    {
      "code": 6007,
      "name": "insufficientAvailable",
      "msg": "Not enough bonds available in the listing."
    },
    {
      "code": 6008,
      "name": "notIssuer",
      "msg": "Signer is not the bond issuer."
    },
    {
      "code": 6009,
      "name": "issuerCannotBuy",
      "msg": "Issuer cannot buy their own bonds."
    },
    {
      "code": 6010,
      "name": "paymentMintMismatch",
      "msg": "Payment mint does not match the listing's payment mint."
    },
    {
      "code": 6011,
      "name": "holderHasNoBonds",
      "msg": "Holder has no bonds."
    },
    {
      "code": 6012,
      "name": "couponOverpaid",
      "msg": "Holder is already fully paid (would overpay)."
    },
    {
      "code": 6013,
      "name": "noCouponPending",
      "msg": "No coupon pending for this holder."
    },
    {
      "code": 6014,
      "name": "mathOverflow",
      "msg": "Math overflow."
    }
  ],
  "types": [
    {
      "name": "bondConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "issuer",
            "type": "pubkey"
          },
          {
            "name": "nominalValue",
            "type": "u64"
          },
          {
            "name": "interestRateBps",
            "type": "u16"
          },
          {
            "name": "durationYears",
            "type": "u8"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "holder",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bondMint",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "bondsHeld",
            "type": "u64"
          },
          {
            "name": "couponsPaid",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "listing",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bondMint",
            "type": "pubkey"
          },
          {
            "name": "paymentMint",
            "type": "pubkey"
          },
          {
            "name": "unitPrice",
            "type": "u64"
          },
          {
            "name": "available",
            "type": "u64"
          },
          {
            "name": "totalSold",
            "type": "u64"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "escrow",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
