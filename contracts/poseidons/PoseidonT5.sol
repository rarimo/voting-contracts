/// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

/// Source: https://github.com/vimwitch/poseidon-solidity

library PoseidonT5 {
    uint constant F =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    uint constant M00 = 0x251e7fdf99591080080b0af133b9e4369f22e57ace3cd7f64fc6fdbcf38d7da1;
    uint constant M01 = 0x2a70b9f1d4bbccdbc03e17c1d1dcdb02052903dc6609ea6969f661b2eb74c839;
    uint constant M02 = 0x2f69a7198e1fbcc7dea43265306a37ed55b91bff652ad69aa4fa8478970d401d;
    uint constant M03 = 0x0c3f050a6bf5af151981e55e3e1a29a13c3ffa4550bd2514f1afd6c5f721f830;
    uint constant M04 = 0x2a20e3a4a0e57d92f97c9d6186c6c3ea7c5e55c20146259be2f78c2ccc2e3595;
    uint constant M10 = 0x25fb50b65acf4fb047cbd3b1c17d97c7fe26ea9ca238d6e348550486e91c7765;
    uint constant M11 = 0x281154651c921e746315a9934f1b8a1bba9f92ad8ef4b979115b8e2e991ccd7a;
    uint constant M12 = 0x001c1edd62645b73ad931ab80e37bbb267ba312b34140e716d6a3747594d3052;
    uint constant M13 = 0x0dec54e6dbf75205fa75ba7992bd34f08b2efe2ecd424a73eda7784320a1a36e;
    uint constant M14 = 0x1049f8210566b51faafb1e9a5d63c0ee701673aed820d9c4403b01feb727a549;
    uint constant M20 = 0x293d617d7da72102355f39ebf62f91b06deb5325f367a4556ea1e31ed5767833;
    uint constant M21 = 0x28c2be2f8264f95f0b53c732134efa338ccd8fdb9ee2b45fb86a894f7db36c37;
    uint constant M22 = 0x15b98ce93e47bc64ce2f2c96c69663c439c40c603049466fa7f9a4b228bfc32b;
    uint constant M23 = 0x1c482a25a729f5df20225815034b196098364a11f4d988fb7cc75cf32d8136fa;
    uint constant M24 = 0x02ecac687ef5b4b568002bd9d1b96b4bef357a69e3e86b5561b9299b82d69c8e;
    uint constant M30 = 0x104d0295ab00c85e960111ac25da474366599e575a9b7edf6145f14ba6d3c1c4;
    uint constant M31 = 0x21888041e6febd546d427c890b1883bb9b626d8cb4dc18dcc4ec8fa75e530a13;
    uint constant M32 = 0x12c7e2adfa524e5958f65be2fbac809fcba8458b28e44d9265051de33163cf9c;
    uint constant M33 = 0x2625ce48a7b39a4252732624e4ab94360812ac2fc9a14a5fb8b607ae9fd8514a;
    uint constant M34 = 0x2d3a1aea2e6d44466808f88c9ba903d3bdcb6b58ba40441ed4ebcf11bbe1e37b;
    uint constant M40 = 0x0aaa35e2c84baf117dea3e336cd96a39792b3813954fe9bf3ed5b90f2f69c977;
    uint constant M41 = 0x14ddb5fada0171db80195b9592d8cf2be810930e3ea4574a350d65e2cbff4941;
    uint constant M42 = 0x2efc2b90d688134849018222e7b8922eaf67ce79816ef468531ec2de53bbd167;
    uint constant M43 = 0x07f017a7ebd56dd086f7cd4fd710c509ed7ef8e300b9a8bb9fb9f28af710251f;
    uint constant M44 = 0x14074bb14c982c81c9ad171e4f35fe49b39c4a7a72dbb6d9c98d803bfed65e64;

    // See here for a simplified implementation: https://github.com/vimwitch/poseidon-solidity/blob/e57becdabb65d99fdc586fe1e1e09e7108202d53/contracts/Poseidon.sol#L40
    // Inspired by: https://github.com/iden3/circomlibjs/blob/v0.0.8/src/poseidon_slow.js
    function hash(uint[4] memory) public pure returns (uint) {
        assembly {
            // memory 0x00 to 0x3f (64 bytes) is scratch space for hash algos
            // we can use it in inline assembly because we're not calling e.g. keccak
            //
            // memory 0x80 is the default offset for free memory
            // we take inputs as a memory argument so we simply write over
            // that memory after loading it

            // we have the following variables at memory offsets
            // state0 - 0x00
            // state1 - 0x20
            // state2 - 0x80
            // state3 - 0xa0
            // state4 - ...

            function pRound(c0, c1, c2, c3, c4) {
                let state0 := add(mload(0x0), c0)
                let state1 := add(mload(0x20), c1)
                let state2 := add(mload(0x80), c2)
                let state3 := add(mload(0xa0), c3)
                let state4 := add(mload(0xc0), c4)

                let p := mulmod(state0, state0, F)
                state0 := mulmod(mulmod(p, p, F), state0, F)

                mstore(
                    0x0,
                    add(
                        mod(
                            add(
                                add(
                                    add(mulmod(state0, M00, F), mulmod(state1, M10, F)),
                                    mulmod(state2, M20, F)
                                ),
                                mulmod(state3, M30, F)
                            ),
                            F
                        ),
                        mulmod(state4, M40, F)
                    )
                )
                mstore(
                    0x20,
                    add(
                        mod(
                            add(
                                add(
                                    add(mulmod(state0, M01, F), mulmod(state1, M11, F)),
                                    mulmod(state2, M21, F)
                                ),
                                mulmod(state3, M31, F)
                            ),
                            F
                        ),
                        mulmod(state4, M41, F)
                    )
                )
                mstore(
                    0x80,
                    add(
                        mod(
                            add(
                                add(
                                    add(mulmod(state0, M02, F), mulmod(state1, M12, F)),
                                    mulmod(state2, M22, F)
                                ),
                                mulmod(state3, M32, F)
                            ),
                            F
                        ),
                        mulmod(state4, M42, F)
                    )
                )
                mstore(
                    0xa0,
                    add(
                        mod(
                            add(
                                add(
                                    add(mulmod(state0, M03, F), mulmod(state1, M13, F)),
                                    mulmod(state2, M23, F)
                                ),
                                mulmod(state3, M33, F)
                            ),
                            F
                        ),
                        mulmod(state4, M43, F)
                    )
                )
                mstore(
                    0xc0,
                    add(
                        mod(
                            add(
                                add(
                                    add(mulmod(state0, M04, F), mulmod(state1, M14, F)),
                                    mulmod(state2, M24, F)
                                ),
                                mulmod(state3, M34, F)
                            ),
                            F
                        ),
                        mulmod(state4, M44, F)
                    )
                )
            }

            function fRound(c0, c1, c2, c3, c4) {
                let state0 := add(mload(0x0), c0)
                let state1 := add(mload(0x20), c1)
                let state2 := add(mload(0x80), c2)
                let state3 := add(mload(0xa0), c3)
                let state4 := add(mload(0xc0), c4)

                let p := mulmod(state0, state0, F)
                state0 := mulmod(mulmod(p, p, F), state0, F)
                p := mulmod(state1, state1, F)
                state1 := mulmod(mulmod(p, p, F), state1, F)
                p := mulmod(state2, state2, F)
                state2 := mulmod(mulmod(p, p, F), state2, F)
                p := mulmod(state3, state3, F)
                state3 := mulmod(mulmod(p, p, F), state3, F)
                p := mulmod(state4, state4, F)
                state4 := mulmod(mulmod(p, p, F), state4, F)

                mstore(
                    0x0,
                    add(
                        mod(
                            add(
                                add(
                                    add(mulmod(state0, M00, F), mulmod(state1, M10, F)),
                                    mulmod(state2, M20, F)
                                ),
                                mulmod(state3, M30, F)
                            ),
                            F
                        ),
                        mulmod(state4, M40, F)
                    )
                )
                mstore(
                    0x20,
                    add(
                        mod(
                            add(
                                add(
                                    add(mulmod(state0, M01, F), mulmod(state1, M11, F)),
                                    mulmod(state2, M21, F)
                                ),
                                mulmod(state3, M31, F)
                            ),
                            F
                        ),
                        mulmod(state4, M41, F)
                    )
                )
                mstore(
                    0x80,
                    add(
                        mod(
                            add(
                                add(
                                    add(mulmod(state0, M02, F), mulmod(state1, M12, F)),
                                    mulmod(state2, M22, F)
                                ),
                                mulmod(state3, M32, F)
                            ),
                            F
                        ),
                        mulmod(state4, M42, F)
                    )
                )
                mstore(
                    0xa0,
                    add(
                        mod(
                            add(
                                add(
                                    add(mulmod(state0, M03, F), mulmod(state1, M13, F)),
                                    mulmod(state2, M23, F)
                                ),
                                mulmod(state3, M33, F)
                            ),
                            F
                        ),
                        mulmod(state4, M43, F)
                    )
                )
                mstore(
                    0xc0,
                    add(
                        mod(
                            add(
                                add(
                                    add(mulmod(state0, M04, F), mulmod(state1, M14, F)),
                                    mulmod(state2, M24, F)
                                ),
                                mulmod(state3, M34, F)
                            ),
                            F
                        ),
                        mulmod(state4, M44, F)
                    )
                )
            }

            // scratch variable for exponentiation
            let p

            {
                // load the inputs from memory
                let state1 := add(
                    mod(mload(0x80), F),
                    0x0554d736315b8662f02fdba7dd737fbca197aeb12ea64713ba733f28475128cb
                )
                let state2 := add(
                    mod(mload(0xa0), F),
                    0x2f83b9df259b2b68bcd748056307c37754907df0c0fb0035f5087c58d5e8c2d4
                )
                let state3 := add(
                    mod(mload(0xc0), F),
                    0x2ca70e2e8d7f39a12447ac83052451b461f15f8b41a75ef31915208f5aba9683
                )
                let state4 := add(
                    mod(mload(0xe0), F),
                    0x1cb5f9319be6a45e91b04d7222271c94994196f12ed22c5d4ec719cb83ecfea9
                )

                p := mulmod(state1, state1, F)
                state1 := mulmod(mulmod(p, p, F), state1, F)
                p := mulmod(state2, state2, F)
                state2 := mulmod(mulmod(p, p, F), state2, F)
                p := mulmod(state3, state3, F)
                state3 := mulmod(mulmod(p, p, F), state3, F)
                p := mulmod(state4, state4, F)
                state4 := mulmod(mulmod(p, p, F), state4, F)

                // state0 pow5mod and M[] multiplications are pre-calculated

                mstore(
                    0x0,
                    add(
                        mod(
                            add(
                                add(
                                    add(
                                        0x1282bc78005ba97a80ccae28ce172790ca301e19e52354333993891b9fd27bd4,
                                        mulmod(state1, M10, F)
                                    ),
                                    mulmod(state2, M20, F)
                                ),
                                mulmod(state3, M30, F)
                            ),
                            F
                        ),
                        mulmod(state4, M40, F)
                    )
                )
                mstore(
                    0x20,
                    add(
                        mod(
                            add(
                                add(
                                    add(
                                        0x25ce673773c90bcab91ecf14a691cbc59aeff5abfff4cfc7c6a85d51a79468fa,
                                        mulmod(state1, M11, F)
                                    ),
                                    mulmod(state2, M21, F)
                                ),
                                mulmod(state3, M31, F)
                            ),
                            F
                        ),
                        mulmod(state4, M41, F)
                    )
                )
                mstore(
                    0x80,
                    add(
                        mod(
                            add(
                                add(
                                    add(
                                        0x2933f130a05a81186977481f40b428b2fa98c4a8f2561aad43098fb380f746b7,
                                        mulmod(state1, M12, F)
                                    ),
                                    mulmod(state2, M22, F)
                                ),
                                mulmod(state3, M32, F)
                            ),
                            F
                        ),
                        mulmod(state4, M42, F)
                    )
                )
                mstore(
                    0xa0,
                    add(
                        mod(
                            add(
                                add(
                                    add(
                                        0x178f5c848248d8ae30d9d4e6c27ec06995bba97b9d0ab13bb7b63e121958133e,
                                        mulmod(state1, M13, F)
                                    ),
                                    mulmod(state2, M23, F)
                                ),
                                mulmod(state3, M33, F)
                            ),
                            F
                        ),
                        mulmod(state4, M43, F)
                    )
                )
                mstore(
                    0xc0,
                    add(
                        mod(
                            add(
                                add(
                                    add(
                                        0x1f52dac6047456323348e214a18a3aad024561b12c7ca045cd2484b9d4ffe3c0,
                                        mulmod(state1, M14, F)
                                    ),
                                    mulmod(state2, M24, F)
                                ),
                                mulmod(state3, M34, F)
                            ),
                            F
                        ),
                        mulmod(state4, M44, F)
                    )
                )
            }

            fRound(
                0x2eb4f99c69f966ebf8a42192de7ff61621c7bb47b93750c2b9ea08d18446c122,
                0x224a28e5a35385a7c5198169e405d9ea0fc7da8b93ee13b6d5f7d099e299520e,
                0x0f7411b465e600eed8afdd6afca49c3036f33ecbd9a0f97823796b993bbd82f7,
                0x0f9d0d5aad2c9555a2be7150392d8d9819b208ae3370f99a0626f9ff5d90e4e3,
                0x1e9a96dc8292bb596f52a59538d329229732b25259cf744b6a12d30702d6fba0
            )

            fRound(
                0x08780514ccd90380887d578c45555e593cfe52eab4b945c6c2cd4d528fb3fe3c,
                0x272498fced686c7ac8149fa3f73ef8c2ced64717e3556d5a59f119d629ccb5fc,
                0x01ef8f9dd7c93aac4b7cb80930bd06eb45bd350aff585f10e3d0ef8a782ef7df,
                0x045b9f59b6595e614dc08f222b469b138e886e64bf3c40aa97ea0ae754934d30,
                0x0ac1e91c57d9da919fd6f59d2a40ff8ea3e41e24e247a387adf2584295d61c66
            )

            fRound(
                0x028a1621a94054b0c7f9a421353cd89d0fd67061aee99979d12e68f04e62d134,
                0x26b41802c071ea4c9632647ed059236e50c19c3fb3c96d09d02aae2a0dcd9dbc,
                0x2fb5dda8072bb72cbaac2f63e468215e05c9de06758db6a94af34384aedb462b,
                0x2212d3a0f5fccaf244ff3547fd823249ad8ab8ba2a18d383dd05c56ee894d850,
                0x1b041ad5b2f0684258e4dfaeea09be56a3276fdb19f44c015cd0c7eed465e2e3
            )

            pRound(
                0x0a01776bb22f4b6b8eccff33e76fded3144fb7e3ac14e846a91e64afb1500eff,
                0x2b7b5674aaecc3cbf34d3f275066d549a4f33ae8c15cf827f7936440810ace43,
                0x29d299b80cd4489e4cf75779ed54b48c60b042257b78fc004c1b803381a3bdfd,
                0x1c46831d9a74529357641c219d721a74a427110032b5e1dd19dde30424be401e,
                0x06d7626c953ccb72f37141dc34d578e036296c0657674f80739ae1d883e91269
            )

            pRound(
                0x28ffddc86f18c136c54002748e0c410edc5c440a3022cd960f108c71cda2930c,
                0x2e67f7ee5e4aa295f85deed09e400b17be67f1b7ed2ab6adb8ec0619f6fbc5e9,
                0x26ce38fa636c90630e97f25114a79a2dca56859ef759e53ce7abf22c24e80f27,
                0x2e6e07c3c95bf7c34dd7a01d00a7ffec42cb3d16a1f72721afacb4c4cfd35db1,
                0x2aa74f7597f0c9f45f91d7961c3a54fb8890d276612e1246384b1470da24d8cc
            )

            pRound(
                0x287d681a46a2faae2c7c090f668ab45b8a71313c1509183e2ec0ca639b7f73fe,
                0x212bd19df812eaaef4a40600528f3d7da5d3106ff565aa3b11e29f3305e73c04,
                0x1154f7cf519186bf1aafb14b350eb860f97fd9740926dab93809c28404713504,
                0x1dff6385cb31f1c24637810a4bd1b16fbf5152905be36583da747e79661fc207,
                0x0e444582d22b4e76c081d34c44c18e424011a34d5476252863ea3c606b551e5c
            )

            pRound(
                0x0323c9e433ba66c4abab6638328f02f1815773e9c2846323ff72d3aab7e4eff8,
                0x12746bbd71791059193bba79cdec448f25b8cf002740112db70f2c6876a9c29d,
                0x1173b7d112c2a798fd9b9d3751842c75d466c837cf50d73efd049eb4438a2240,
                0x13d51c1090a1ad4876d1e555d7fed13da8e5713b25026ebe5fdb4808703243da,
                0x00874c1344a4ad51ff8dcb7cbd2d9743cb72743f0394efe7f4a58ebeb956baa1
            )

            pRound(
                0x22df22131aaab85865ce236b07f244fa0eea48d3546e97d6a32a562074fef08f,
                0x0bf964d2dbd25b908708b437a445fc3e984524a59101e6c18bf5eb05a919f155,
                0x09b18d9b917a55bca302be1f7f181e0e640b9d73a9ab298c69b435b5fc502f32,
                0x094f5534444fae36a4bfc1d5bf3dc05bfbbbc70a6365366dd6745a5067289e43,
                0x2999bab1a5f25210519fa6622af53a15a3e240c0da5701cb784fddc0dc23f01f
            )

            pRound(
                0x2f6898c07581f6371ca94db73710e88084301bce8a93d13669575a11b03a3d23,
                0x07268eaaba08bc19ec16d7e1318a4740565deb1e8e5742f862174b1a6866fccb,
                0x186279b003454db01339ff77113bc9eb62603e078e1c6689a6c9582c41a0529f,
                0x18a3f736509197d6e4915bdd04d3e5ddb67e2cc5de9a22750768e5524737172c,
                0x0a21fa1988cf38d877cc1e2ed24c808c725e2d4bcb2d3a007b5987b87085671d
            )

            pRound(
                0x15b285cbe26c467f1faf5ef6a64625228328c184a2c43bc00b36a135e785fba2,
                0x164b7062c4671cf08c08b8c3f9806d560b7775b7c902f5788cd28de3e779f161,
                0x0890ba0819ac0a6f86d9865fe7e50ef361c61d3d43b6e65d7a24f651249baa70,
                0x2fbea4d65d7ed425a42712e5a721e4eaa627ac5cb0eb878ccc2ee0aed543e922,
                0x0492bf383c36fa55540303a3b536f85e7b70a58e854ab9b9103d7f5f379abaaa
            )

            pRound(
                0x05e91fe944e944104e20251c565142d61d6185a9ce85675f6a969d56292dc24e,
                0x12fe5c2029e4b33893d463cb041acad0995b9621e6e49c3b7e380a76e36e6c1c,
                0x024154adf0255d47958f7723921474131f2629fadc89496906cd01dc6fa0784e,
                0x18824a09e6afaf4a36ed2462a86bd0bad798815644f2bbde8813c13457a45550,
                0x0c8b482dba0ad51be9f255de0c3dbddddf84a630af68d50bbb06983e3d5d58a5
            )

            pRound(
                0x17325fd0ab635871363e0a1667d3b67c5a4fa67fcd6aaf86441392878fdb05e6,
                0x050ae95f6d2f1519122f5af67b690f31e550773fa8d18bf71cc6d0e911fa402e,
                0x0f0d139a0e81e943038cb288d62636764bbb6295f07569885771ec84edc50c40,
                0x1c0f8697795689cdf70fd2f2c0f93d1a79b39ebc7a1b1c549dbbca7b8e747cd6,
                0x2bd0f940ad936b796d2bc2e048bc979e49be23a4b13598f9fe536a16dc1d81e6
            )

            pRound(
                0x27eb1be27c9c4e934778c09a0053337fa06ebb275e096d167ce54d1e96ee62cb,
                0x2e4889d830a67e5a8f96bdd3155a7ca3284fbd307d1f71b0f151be62548e2aea,
                0x193fe3db0ab47d3c5d2ec5e9c5bd9983c9891f2cadc165db6064bbe6fcc1e305,
                0x2bf3086e96c36c7bce415907ad0c40ed6e9661c009679e4e37cb13027c83e525,
                0x12f16e2de6d4ad46a98cdb697c6cad5dd5e7e413f741ccf29ff2ea486e59bb28
            )

            pRound(
                0x2a72147d230119f3a0262e3653ddd19f33f3d5d6ec6c4bf0ad919b0343b92d2f,
                0x21be0e2c4bfd64e56dc47f957806dc5f0a2d9bcc26412e2977df79acc10ba974,
                0x0e2d7e1dc946d70b2749a3b54367b25a71b84fb911aa57ae137fd4b6c21b444a,
                0x2667f7fb5a4fa1246170a745d8a4188cc31adb0eae3325dc9f3f07d4b92b3e2e,
                0x2ccc6f431fb7400730a783b66064697a1550c12b08dfeb72830e107da78e3405
            )

            pRound(
                0x08888a94fc5a2ca34f0201462420001fae6dbee9e8ca0c242ec50621e38e6e5d,
                0x02977b34eeaa3cb6ad40dd42c9b6fdd7a0d2fbe753af88b36acfcd3ccbc53f2a,
                0x120ccce13d28b75cfd6fb6c9ea13a648bfcfe0d7e6ff8e9610b5e9f971e16b9a,
                0x09fad2269c4a8e93c81e1b9770ea098c92787a4575b2bd73a0bf2af32f86ff3c,
                0x026091fd3d4c44d50a4b310e4ac6f0fa0debdb70775eeb8af630cffb60092d6f
            )

            pRound(
                0x29404aa2ba565b77bb7fba9dfb6fc3212543cc56afad6afcb904fd2bca893994,
                0x2749475c399aaf39d4e87c2548695b4ef1ffd86590e0827de7201351b7c883f9,
                0x098c842322479f7239912b50424685cba2ebe2dc2e4da70ac7557dab65ffa222,
                0x18cef581222b647e31238e57fead7d5c758ace14c93c4da40191d0c053b51936,
                0x13177839c68a5080d4e746745e43711d3cbc0ca4a108f98d63b2aa681698de60
            )

            pRound(
                0x020ca696f531e43ec088f56f4b74325626cc4df712c0e5f0a907d88e5f0deffd,
                0x27230eede9cccfc9fa805a30fc548db693d13708c646841d16e028387c7ac022,
                0x01645911c1198b01d64fde34a342a1786497c05969a015439057d2fe75bb281c,
                0x2c323fe16481bf496e439c88341ce25f198971e14487056cfdca4a451a5d8643,
                0x0fc082dfe70728e8450bd2074c3e22e1b022c124d3bffe8b5af88ae6db5085c8
            )

            pRound(
                0x2052c174800db209d8cdca568dcc25b3be9642116ac4c77efe8a488b423521ee,
                0x28e420e10df2fbb5af96d621d55423190be351ce8129065a8dd9fd05b3ece9c0,
                0x25698ca5e24a1b799f783c4462a24db655d6ae1bdacd1cb549d6e0bc3ae5069a,
                0x160a9981a5c89a57cf8ffbfa57d51049a297b61074422ac134d9b857d6984d35,
                0x21c91a39e145c3bc34d9b694b843f3bf8b7cebf59ddbb0a064642b069997f3d4
            )

            pRound(
                0x1ac8d80dcd5ee876d2b09345ef112345d6eaa029d93f03b6d10975461e41734c,
                0x0ab3e6ad0ecf8b8e7c1662a4174c52225d822895e2755544b8dbcea5657ce02c,
                0x1c675182512620ae27e3b0b917b3a21ca52ef3ef5909b4e1c5b2237cbdab3377,
                0x2cdbc998dfd7affd3d948d0c85bad2e2e37a4a3e07a7d75d0c8a9092ac2bed45,
                0x23b584a56e2117b0774bf67cc0dee33324337350309dff833e491a133bb63b2e
            )

            pRound(
                0x1e9e2b310f60ba9f8cb73030a3c9d2a10d133bc6ba4ec1152f3d20de1465e9a5,
                0x0e01e365ba5b3031abc3e720140ae746c9ab5dab987520c460bcd4f1fa5b22db,
                0x040884cdcfc64bfc7b7127340498d5c443382011b61c9a4b1387d85bc1264e68,
                0x190b1ee1205eb9500c74a3998f2bea36353f1724d6067ed0a0a17de311ef9668,
                0x1647c72aec6c4388d04f52fc23cd9c08c1dfcf65ce61e165fc28d1f832bd3b2c
            )

            pRound(
                0x2430006346a0145f799880cc4c8736269f5494d89fb48b02842e595b71e4541d,
                0x177b9a08343917e1365107a3da3ae7f69d853902bb16bacb3221850252b757af,
                0x04a420e642b11ae94e58862a68f5e32609cd53d0ae29423439b11d04666df4f8,
                0x25d0e0f739fb39fc105a88fab0afd810de2461858e956ccccdfabeddb6a25c8f,
                0x04476d91b7eff2fd85905cbf58651edc320cb15610eaed452c4d4ffa0c740a27
            )

            pRound(
                0x1090c0b68b3d7d7b8bc9ca2419eb8dea1c28f6d5e1250cb5e9780fd9ca286fae,
                0x25393ce3b9256d50448a725c5c7cd5ad376f2d435855c10ebf2899cb5c6617be,
                0x25931c0c7371f4f1fc862f306e6e5830ed824388d6b9342697d144f0fab46630,
                0x2396cb501700bbe6c82aad51b0fb79cf8a4d353185d5808203f73f22afbf62f6,
                0x26a363483348b58954ea748a7129a7b0a3dc9068c3cca7b5b3f0ce03b8724884
            )

            pRound(
                0x27ca107ca204f2a18d6f1535b92c5478c99b893334215f6ba7a0e5b45fcd6897,
                0x26da28fc097ed77ce4662bde326b2cceac15f7301178581d8d2d02b3b2d91056,
                0x056ab351691d8bb3703e3055070ac9cc655774c1bb35d57572971ba56ee0cb89,
                0x2638b57f23b754aec76d109a2f481aa3c22547a11ffc50152d729af632376a90,
                0x304754bb8c57d60732f492c2605184fdc33e46a532bdec80ea7bc5519ede7cef
            )

            pRound(
                0x00d1727f8457ee03514f155b5806cbf748ec6857fc554010752ac93a9b7619ac,
                0x00ee1f3c66fbc05c43ba295a303c72fab5bca86805ec9419c588e50947761fa3,
                0x0afafadcf5b4dd4a4a76b5a1d82415fd10a19fbcfc59078c61f9297eb675d972,
                0x0b2449f39746085e86ce45e8eed108ee65a234835a0a6a5ea8996d124dd04d0a,
                0x206b0ce2f1b2c5b7c9f37b0045227095f6c6f071ec3bdda76a7ddf4823dd5dd6
            )

            pRound(
                0x0feba4fb87834c7cb696e67433628cd6caffc3a4ef20fea852c7e1029459409c,
                0x254dbfac74c49b0b8926752e084e02513b06f1315e6d70e18173e972336e55d3,
                0x0addb1372cee4e164655168c367559e19606c5bd17910aeb37719edfa0ca8762,
                0x26b25b7e257f3e97c799024fb019f65c6ca4d8d81b1ae16221a589d68831d759,
                0x090995b79acec240413b8d4c658787e5a4657b9ab00bdb5b1960b1059e113ba3
            )

            pRound(
                0x08dbdc2e21ef11f2c57299687843cea3eb0d8e40e99131f42974178d44f73b7b,
                0x09e8aba671481197679faf752a0f78e342fe9c491596ab6758f170939785179f,
                0x1deb05180e833e45659052a7ebaf816c7efd12a7f9eec94b7bc7c683f1363d5c,
                0x19a70ec6bdfc9098a926efbcc04aa9ee248997e8b2c24af335fd6523e5250879,
                0x21d773660adafb8a879986f9aab4890566353a3777d8a3f1eb93abe10bbf1f64
            )

            pRound(
                0x09f1890f72e9dc713e20ba637b89d5d397a6b01fcd667347f6f46617841c3901,
                0x05af459361eb454d2a300c61e446998d48fa1f897bf219d608c2145c33b111c3,
                0x0fa1a1d6829f0345664a66dc75a657335f336f15f340756cfa12fc850cc8b513,
                0x02e47a35bcc0c3a0bda0b1c0307ad543f4280fcf87f636f853655cf97a628bb0,
                0x14f773e9834c6bdeb8f90e78bf4c24b7203411460112491036621895204d0f12
            )

            pRound(
                0x102d98cf502ed843255cf19d29bc7d8e642abe7cfd639992ffb091962fc8f7cc,
                0x043dd5f4aa5a76dd4c47f6c65da7ca2320d4c73ad3294738cba686a7e91373c2,
                0x21833819c3337194a6c0d29a48d4f2676f0e7c79743a306f4cfdb2b26bd11efa,
                0x0f281925cf5ee649b474a6819d116ca3eb4eca246c311ecadc53262a3cff2b53,
                0x0d3e2477a7b10beb44709c7746d6824edf625dd60504d5dc93ce662f15c238d6
            )

            pRound(
                0x2cd7f641bedbf66956ff8a01be9cde35d80f80ab51e73b49acbfc3eff5aefc44,
                0x29e95b492bf2f95f4d09380f98b74e389149d24045811d7a86dd861310463cf8,
                0x22da66bc62e8f011266efca86a6c810f9ae4c51af6ffeb57f8b3c50df83cc13e,
                0x0fe6d30de7a82d163023491794f4aca3220db79e8129df3643072d841925554a,
                0x0050e842a1299909123c46eff185c23ad312d03fef1adfecc7e07ecb298fd67f
            )

            pRound(
                0x2130a3a7b3221222be34cc53a42d7733666f9ddf714ed7c5885cbbdb63108c21,
                0x2df9ee294edf99e3d8d5883fe0566c24aa66731f34a93280e1d328e67b33c9fa,
                0x1bf7d6e489ad8c0cf26eb68cc21ff54158132396dc250aeba4b6fc5fc3372762,
                0x0c602fa155be958761eaf739617ab136cf7b807728bf7fe35d4778d311780e54,
                0x2e50e2c5b36aa20532407d86b8d22d7d5154080a24972faeb63faf0121ed7f21
            )

            pRound(
                0x17c2510982a7b5825710d6290ec4f782f674995ee8409b42b459123b180332e1,
                0x0b0d52f03c8af7276803ecf2465b885b21337b538eabd2f6b2ab255f376b42a8,
                0x0f5633df1972b9455953d88a63f80647a9ac77c6c0f85d4561972dd8fab8bd14,
                0x0ebf7ad29ca13804e1422e939681155124780ff43e76e929035498130a7f1572,
                0x1aff13c81bda47e80b02962173bba343e18f94bee27c8a57661b1103a720ffe2
            )

            pRound(
                0x210449dbf5cf3061da2465be85505862d3f31de1a3b58ff35713be57efac6c07,
                0x088230c2794e50c57d75cd6d3c7b9dbe19d1e2f1d3001044b93ad1c3ee629817,
                0x1c408c256490b0a1da08dc464138dfc78cce9a9e16c7705617a4d6dbb20e7e3a,
                0x074517e081eb4c1f22d1771200fb07658f7c77654d58440490dd6f557e9e3903,
                0x02d04e9c21df1dbd88524bdb203691b4cee5530559d6cf0fa05adf61e12fdcbf
            )

            pRound(
                0x2eb7a011b8bce91082e13ebd75de3b58eb9b4650dae9f11aa81db32cf1b67b13,
                0x2efda77ed35f4af0299f75d6e8a849b54d2ac6bf95368304e6030c18f0cf17b5,
                0x09199dcafd50ce642eddbeda65206d4f61a73d10852b8114c51b2440192ae064,
                0x268c5cfc446d399c4dd319db666a75b5cb655d8c1797e9fa76181cb4216e1562,
                0x2303a652c949071826b0e9a36c80578697b44e912cce6687012854eda11a18dc
            )

            pRound(
                0x27c53563b12a6ee2c3f041f31dc45922bc5353eb110868d237073f4efb35fbdf,
                0x1201a87eaf4ae618f02bd82d0a5109049969b5248cfe90f42c278f22615d2b0e,
                0x2c43169439fcd69ead8214997bb069becafcb1ba2c51e5706cb4b43dab2a443d,
                0x0683597315359040ea03c45d6984c6894f46cbb36d702e3c4fb9847e6304d944,
                0x03545706706eab36afb93b128febd16fb0425e158314197b77795ad3a798d183
            )

            pRound(
                0x1a33c254ec117619d35f1fc051b31728740bed23a6a37870edb393b71a0c0e6b,
                0x1ffe6968a4470cd567b0c002281caf996e88f71e759b87e6f338e517f1690c78,
                0x0fd66e03ba8808ffecb059c899fd80f4140ddd5d2a5c4483107f4e02e355b393,
                0x263ab69f13b966f8197394552906b17e6c8617a7bdd5d74a7be3396b7fe013ab,
                0x16a425e47d1110625054d5a165de413e3bd87d5aa3958fdd6eb7e03e39ba4046
            )

            pRound(
                0x2dc510a4719ec10cad752f03c673f0e253cc31d13e39e909fcc5f73af9138d9a,
                0x24df8e8d856c5b5e1bd1cad23d07dda3423c5179329b7a82cb4aa709a94576e5,
                0x2bcc94ff4fc3c76f3cd5c68915a042e87628249a01b09561bdf24a6cdce5620f,
                0x076c1e88dc540c8d8de54e343df7c429d3295f52c38cffe6b48be86852da97df,
                0x09b5f209a451ac431c051fb12d9a5e4fe40ee1601120947da990fb8e12cb46e1
            )

            pRound(
                0x205f17b0d8729e2eaa88d6a44135a6ab64e9424f55b0f1ea0683af75eb677c07,
                0x281c5c688836f6cf912638c38be046cd091681f0a41761720cdd1edf9f237029,
                0x1a053e6878e900f45f4d67448c471cf3009a44e7a02ea50e4afa44f2592621f5,
                0x100dc7d426debe3007fb7ceac84e4f5468efcb897e7bbee981742839d59e064c,
                0x17022672a016a957bb87e2cfadc8b75fb28905bdb62c82c80b1cb31b411e49c8
            )

            pRound(
                0x1086db7e2760fc8b71053a87ebe151239fb8b547182b170de0c27203f954f4d2,
                0x15384fe39d73b63302460ae4c2942fac2b41fb65a185536fb85dd24fd7584064,
                0x2ebb599fe9136d424bf4abc5342c6c7447b1a853205fcfb5519e551357709008,
                0x1b4b5e87cfb9262cfec3c0f0542e4c5a4cf278292b4ce3eed996fac6f4d37288,
                0x2465053ae50b6885801f3f82e302cafbbb4a7581bb4fba60b637febe659e5057
            )

            pRound(
                0x114f32edcdea09cd095c5bb5d38f1b97da9f05e18b3708bf6e0ab9d3d54859ef,
                0x2bc70dfeb2baab2f6b387cd77be779ac2e5e5519f3d18123ee28d8c2543c7148,
                0x01c9bf7a203ce22b775e3a61ad7e77b6a78348b9f6ec68a412e49bfe32c05415,
                0x0514b0fe5909ea887bedb0295fbbcec355cfb575ff6a97cd9f4ad00ccb57ee9b,
                0x267c76ec81934cc81a132a8b058910a12092520b12a201af03e3202d7b6c1b7e
            )

            pRound(
                0x29170e3322b3d8d5c78c84babbb470adf1622493ce83e95cfb151cf757bde5d6,
                0x019f6a8124b19e33af33e5d3873f9c335c6f09a45486cab536dd596ca41d9519,
                0x1904aa4d6908544a8b348e9db1981c27009ed8ea171518ae5405d036242b60e9,
                0x26f17873949bc679f7f043956694e422b3cee1de9dd6f6473b932a476455ff1a,
                0x1ac668f612b8243c193b33720b8aa54040c476031197131ebdcac9b18bc48f75
            )

            pRound(
                0x0996d961a75c0d07196dae45bf624766ccfbf8555be9796da52f81568ef0663d,
                0x030c97e1b8cad1d4fd50d1b4383fbe6674d171f99c63febb5425b395c24fc819,
                0x06e3ad6a46900e2d3953370255b68f89b3e523f1fe502642ee226f2d8bd0848f,
                0x1d6b3755331cd0216b6880e42f9880f565cb94b0e0455153a329890588cc916e,
                0x28e4dcba4b96f12a59b041535e730ac8c35189dc0b85ac033dd38c08bae531f2
            )

            pRound(
                0x08b6086046a835508ccf484f2974b6a6b0712a476260376c7a3b3e4bc4a47a14,
                0x162cd2ca7fe3b5f1444bcec97812019bb6fd85fba6a0536a89643e15b9bb3b52,
                0x28f1e03baaea9bbc05af5b11937e4f5cb5c9a9c1192063d1998c01c64d483a76,
                0x1bdb062778d7c15da395af2734c25faa0127d2aab4aa71366031a0bb6791ce10,
                0x2375839502e09890cb2914e829627e0e0fc98870b2324a8b50329ebdd24749cb
            )

            pRound(
                0x1fa8662fbcb61fb3ad7c55668dc9423a332dc87cfb2df456e92d33611ed7bb50,
                0x1e4fad2dd6b0a6f1f8707f721716c8a446e2fb2c47a5138f3f7f9736079d7694,
                0x211256d16c7269fd6df6f5fcdd1fa788ba3bd050059f53d261b0f5f13731ffe7,
                0x2e49084b336eceaa4f8e2a2e6af08318f42060e574dda341f4a1079b12bcc5a5,
                0x0ce19f54cdc39f7f3bf35192ac6808211aecea08dfe14cab758d25891fb00bb9
            )

            pRound(
                0x0011c5d56c390e893cc394221261d8748dc60451e4ae4e1c84a8468bab2c14cb,
                0x17d79ff06b63ac2a8a9e05ee6af3dbb7ca60e17bfa39b47514a8cd8051579b4c,
                0x19a7d3a446cb5393dc74560093592b06b1a8b35cd6416a2ecab00173639015fa,
                0x030c00a0933dcdba2a808b2e1b9282f331f04596d8928da7aa6c3c97237037a6,
                0x16bcb447ce2d50f3ae25ad080695382e935d2d00184c4acc9370be8aab64139c
            )

            pRound(
                0x12341b46b0150aa25ea4ec8715312997e62124f37cab7b6d39255b7cd66feb1d,
                0x0e86d13917f44050b72a97b2bf610c84002fc28e296d1044dc89212db6a49ff4,
                0x08e6eb4089d37d66d357e00b53d7f30d1052a181f8f2eb14d059025b110c7262,
                0x2ea123856245f6c84738d15dd1481a0c0415ccb351a1e0cee10c48ce97ca7b18,
                0x2dca72b2ebcab8c23446e00330b163104195789025413abf664db0f9c84dfa6f
            )

            pRound(
                0x06ff9ed50d327e8463329f585ec924b3f2f6b4235f036fa4c64a26cbd42b6a6b,
                0x246a10b7e3e0089947f7c9bda3d54df8e2a60e0cca84ea2ac630a4535afbf730,
                0x22a63501c5f04b9018719ed99d700ee52f846a715ae67ad75c96b39d688b6691,
                0x2f4c50477f7fd9c671799ac5d2e224cdb9164f58351d8aa140ec07e514fae937,
                0x10ffb7aad1f51c7d13b17f4d876d9a1e38f0ba8a4a23d4b50cda32cad851567e
            )

            pRound(
                0x0e9cefddc3c2d3bea4d39722532d5420784027352187e7af1a056935c35803ae,
                0x07af84a4d3141e7ac23352e6dc6ea4afa1656f96a33c8978a3e83bdd4ba62b41,
                0x2d9e31a10aebc761f8de00d14b1e566d1a39323d6e89b638e940f3ec8a22c3c5,
                0x27f19a6532e66b5333db1afd592f66f1d36034b314dad8447656747be27e64c7,
                0x0058fa3c8454d63354b2024c3b4a577a180ed99f8f3155cd7e4d617d47d07ffd
            )

            pRound(
                0x041627b6715b780967957c080699343eb0414a205d3a175d708964956816a5d5,
                0x006ac49dd9253edc7f632e57b958ccecd98201471cf1f66589888f12b727c52d,
                0x0131adffd8bd7254b1d8c3616bbe3386ec0c9c0d6d25a9a4ec46a6bf18301398,
                0x1c4a6f52c9fccf7a4138e413ef62a28377977ad7e25e49a3cf030e1cd8f9f5b6,
                0x03f2a6be51ec677f946551b3860ea479fee048ae2078aeb7d1f7958d2c2645f6
            )

            pRound(
                0x2da770aad2c2eb09391a0cb78ef3a9648a1372d8543119564d7376396b8ddc62,
                0x15278463665f74cddc1802febfab02cec9d45fe866c359c738062afb75d64a03,
                0x12fe278aa36544eac9731027090518d434e38ea966a08a6f8d580638ac54c773,
                0x149b9c802182558a4c45d119d3f4cc7fd8587604ca4f0d6e21b06ff30b6a23b6,
                0x0812e7b4d847bc8517d19319772f3c9855e044fd60dbac9a0adc4959b691dfe4
            )

            pRound(
                0x02ed8d8ddeafe3d9d8df7f28a0bfaa7f555813c7e7503aea2a66973703a0c61b,
                0x0ebd073ba0537b514deb6029f921029e55e5e4d9a03d6b6ba1304038662d4db8,
                0x15c754d5b14b2c4205c6ba8d2ccd028255b3e792c6afa08b44ee75b62eff9f59,
                0x169515c89ac5479db0ed8fa6fa311b391cc1235270f4cbc5c29e7cbc30e8732a,
                0x25479fbfb3a68f982388f2621001101608bdc29f6ff037696d9161f5cd9a4fef
            )

            pRound(
                0x14475c4bd520451f3c852cb0311a578ca7f8e6e972182196ce09486e94be6071,
                0x045a691066cc66bec9baf2798833a1dfd3a847502aec8d5f5c4e73363d097799,
                0x26029c0c267c799fb833ac8a11e3a3f0147a8ca037221b90013b8bcb37eba683,
                0x163facb34ff572fbf7c946969c1c260873ce12a6a94a3e45b8101d5b948d1641,
                0x2c714e96e1913b351d969320cc69d5ec13e06a6275e58688af8ee00c4240ee28
            )

            pRound(
                0x1c1661e2a7ce74b75aba84665ecd2bf9ddd6268f06debfe2d52b804eff1d5fa6,
                0x06a69ae795ee9bfe5e5af3e6619a47d26635b34c2a0889fea8c3c068b7dc2c71,
                0x113d58535d892115c5d28b4c19a3609374dbdbadf54195c731416c85d731d46a,
                0x2ab89102e2b8d5e638ff97d761da6042e534f1ff47f7917a2ca1a74063b46101,
                0x03c11ca79e41fdfe962730c45e699546349031893da2b4fd39804fd6a15ad1b3
            )

            pRound(
                0x27096c672621403888014ddbbbfc9da1f7f67b4d4cfe846c6adf040faaf2669c,
                0x2de32ad15497aef4d504d4deeb53b13c66db790ce486130caa9dc2b57ef5be0d,
                0x0dc108f2b0a280d2fd5d341310722a2d28c738dddaec9f3d255754448eefd001,
                0x1869f3b763fe8164c96858a1bb9efad5bcdc3eebc409be7c7d34ca50365d832f,
                0x022ed3a2d9ff31cbf82559fe6a911843b616945e16a568d48c6d33767129682d
            )

            pRound(
                0x2155d6005210169e3944ed1365bd0e7292fca1f27c19c26610c6aec077d026bc,
                0x0de1ba7a562a8f7acae93263f5f1b4bbec0c0556c91af3db3ea5928c8caeae85,
                0x05dbb4406024beabcfce5bf46ec7da38126f740bce8d637b6351dfa7da902563,
                0x05d4149baac413bed4d8dc8ad778d32c00e789e3fcd72dccc97e5427a368fd5e,
                0x01cdf8b452d97c2b9be5046e7397e76ff0b6802fa941c7879212e22172c27b2e
            )

            pRound(
                0x1fc6a71867027f56af8085ff81adce33c4d7c5015eced8c71b0a22279d46c07c,
                0x1040bef4c642d0345d4d59a5a7a3a42ba9e185b75306d9c3568e0fda96aaafc2,
                0x16b79c3a6bf316e0ff2c91b289334a4d2b21e95676431918a8081475ab8fad0d,
                0x20dff1bc30f6db6b434b3a1387e3c8c6a34070e52b601fc13cbe1cdcd59f474e,
                0x0212ac2ab7a6eaaec254955030a970f8062dd4171a726a8bdfb7fd8512ae060d
            )

            pRound(
                0x2f29377491474442869a109c9215637cb02dc03134f0044213c8119f6996ae09,
                0x0984ca6a5f9185d525ec93c33fea603273be9f3866aa284c5837d9f32d814bfa,
                0x0d080a6b6b3b60700d299bd6fa81220de491361c8a6bd19ceb0ee9294b24f028,
                0x0e65cd99e84b052f6789530638cb0ad821acc85b6400264dce929ed7c85a4544,
                0x2e208875bc7ac1224808f72c716cd05ee30e3d20380ff6a655975da12736920b
            )

            pRound(
                0x2989f3ae477c2fd376a0b0ff3d7dfac1ae2e3b894afd29f64a60d1aa8592bad5,
                0x11361ce544e941379222d101e6fac0ce918106a463290a3e3a74c3cea7189459,
                0x1e8d014b86cb5a7da539e10c173f6a75d122a822b8fb366c34c8bd05a2061438,
                0x173f65adec8deee27ba812ad29558e23a0c2324167ef6c91212ee2c28ee98733,
                0x01c36daaf9f01f1bafee8bd0c779ac3e5da5df7ad45499d0991bd695310eddd9
            )

            pRound(
                0x1353acb08c05adb4aa9ab1c485bb85fff277d1a3f2fc89944a6f5741f381e562,
                0x2e5abd2537207cad1860e71ea1188ee4009d33deb4f93aeb20f1c87a3b064d34,
                0x191d5c5edaef42d3d02eedbb7ab8562513deb4eb34913a13421726ba8f69455c,
                0x11d7f8d1f269264282a263fea6d7599d82a04c74c127de9dee7939dd2dcd089e,
                0x04218fde366829ed90f79ad5e67997973445cb4cd6bc6f951bad085286cac971
            )

            pRound(
                0x0070772f7cf52453048397ca5f47a202027b73b489301c3227b71c730d76d6dd,
                0x038a389baef5d9a7c865b065687a1d9b67681a98cd051634c1dc04dbe3d2b861,
                0x09a5eefab8b36a80cda446b2b4b59ccd0f39d00966a50beaf19860789015a6e5,
                0x01b588848b8b47c8b969c145109b4b583d9ec99edfacb7489d16212c7584cd8c,
                0x0b846e4a390e560f6e1af6dfc3341419545e5abfa323d817fed91e30d42954a6
            )

            pRound(
                0x23a6679c7d9adb660d43a02ddb900040eb1513bc394fc4f985cabfe85ce72fe3,
                0x2e0374a699197e343e5caa35f1351e9f4c3402fb7c85ecccf72f31d6fe089254,
                0x0752cd899e52dc4d7f7a08af4cde3ff64b8cc0b1176bb9ec37d41913a7a27b48,
                0x068f8813127299dac349a2b6d57397a50275142b664b802c99e2873dd7ae55a7,
                0x2ba70a102355d549677574167434b3f986872d04a295b5b8b374330f2da202b5
            )

            pRound(
                0x2c467af88748abf6a334d1df03b5521309f9099b825dd289b8609e70a0b50828,
                0x05c5f20bef1bd82701009a2b448ae881e3a52c2d1a31957296d29e5763e8f497,
                0x0dc6385fdc567be5842a381f6006e2c60cd083a2c649d9f23ac8c9fe61b73871,
                0x142d3983f3dc7f7e19d49911b8670fa70378d5b84150d25ed255baa8114b369c,
                0x29a01efb2f6aa894fd7e6d98c96a0fa0f36f86a7a99aa35c00fa18c1b2df67bf
            )

            pRound(
                0x0525ffee737d605138c4a5066644ec630ab9e8afc64555b7d2a1af04eb613a76,
                0x1e807dca81d79581f076677ca0e822767e164f614910264ef177cf4238301dc8,
                0x0385fb3f89c74dc993510816472474d34c0223e0f733a52fdba56082dbd8757c,
                0x037640dc1afc0143e1a6298e53cae59fcfabd7016fd6ef1af558f337bab0ea01,
                0x1341999a1ed86919f12a6c5260829eee5fd56cf031da8050b7e4c0de896074b4
            )

            pRound(
                0x069eb075866b0af356906d4bafb10ad773afd642efdcc5657b244f65bed8ece7,
                0x171c0b81e62136e395b38e8e08b3e646d2726101d3afaa02ea1909a619033696,
                0x2c81814c9453f51cb6eb55c311753e84cbbdcb39bfe696f95575107502acced8,
                0x29d843c0415d35d9e3b33fadcf274b2ab04b39032adca92ce39b8a86a7c3a604,
                0x085d6a1070f3513d8436bccdabb78750d8e15ea5947f2cdaa7669cf3fae7728b
            )

            fRound(
                0x11820363ed541daa10a44ba665bf302cdbf1dd4e6706b02c9e2a5cda412fc394,
                0x201935a58f5c57fc02b60d61a83785bddfd3150e05f1df5d105840b751a16317,
                0x0a8c2820c56971aae27a952abd33a03d46794eedd686cd8ecfed610e87c02e9a,
                0x180638ff301a64ca04abd6d0bd7500b6650b65ff33e6be1fd50dbc163a281877,
                0x095c716266f1de59044f97114a4158a3f85ca8a937cfbec63e9b321a812dd36b
            )

            fRound(
                0x17c31ea02fbc378320d86ffed6c7ca1583b618c5c1a687818d4087a497d73490,
                0x05b86c4bb8ef318b6a7227e4192d149d3c17a9764ccd660de4d50a77f192a91b,
                0x265bc95df4a4c4876ff70d7ea2fde2c7ab15f4a6ae0d237cd6ce74ba986c7a7b,
                0x24752b47bc6c6bc8d9bbe48f5fef2f6908701739c5f5b4b3d6c886d4715c7929,
                0x14814a1e0f492a4ea0d86e527a96482178d624b98da96ee5e583b9324d974efe
            )

            fRound(
                0x10def931073b6479bd60577378f29381997c8e041d3cfb3dc7523bca906f00bd,
                0x14f7ae770bf7e95f7f706c0d8ab4ed03fa0b880d28c69d031b4592c98610175f,
                0x1aef50a0cee751b59f926af40e8035d19decc9d428ebe4e775c5cc9dce1ce589,
                0x041935607172f68eba65ca60068dfe3b086c2a2d57d09602951214b57e73cf5a,
                0x26863e9dd24255d1573bd083959b856c0493fbefe83c819837a151d3bf452cb8
            )

            {
                let state0 := add(
                    mload(0x0),
                    0x2036efb6f9830965eb3d7a068bd087c9f5adf251ba62052c652738e63ff8b3af
                )
                let state1 := add(
                    mload(0x20),
                    0x0c712a975b74dc9d766b639a029969ca30be4f75a753f854b00fa4f1b4f4ee9b
                )
                let state2 := add(
                    mload(0x80),
                    0x08014dab3cd1667e27afc99bfac1e6807afdff6456492ca3375731d387539699
                )
                let state3 := add(
                    mload(0xa0),
                    0x198d07192db4fac2a82a4a79839d6a2b97c4dd4d37b4e8f3b53009f79b34e6a4
                )
                let state4 := add(
                    mload(0xc0),
                    0x29eb1de42a3ad381b23b4131426897a32709b29d53bb946dfd15784d1f63e572
                )

                p := mulmod(state0, state0, F)
                state0 := mulmod(mulmod(p, p, F), state0, F)
                p := mulmod(state1, state1, F)
                state1 := mulmod(mulmod(p, p, F), state1, F)
                p := mulmod(state2, state2, F)
                state2 := mulmod(mulmod(p, p, F), state2, F)
                p := mulmod(state3, state3, F)
                state3 := mulmod(mulmod(p, p, F), state3, F)
                p := mulmod(state4, state4, F)
                state4 := mulmod(mulmod(p, p, F), state4, F)

                mstore(
                    0x0,
                    mod(
                        add(
                            mod(
                                add(
                                    add(
                                        add(mulmod(state0, M00, F), mulmod(state1, M10, F)),
                                        mulmod(state2, M20, F)
                                    ),
                                    mulmod(state3, M30, F)
                                ),
                                F
                            ),
                            mulmod(state4, M40, F)
                        ),
                        F
                    )
                )
                return(0, 0x20)
            }
        }
    }
}
