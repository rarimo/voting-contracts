
[![npm](https://img.shields.io/npm/v/@rarimo/voting-contracts.svg)](https://www.npmjs.com/package/@rarimo/voting-contracts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# Voting Contracts

This repository contains contracts for managing the registration and voting processes, ensuring one user one anonymous 
vote through the integration of the Rarimo protocol and zk-SNARKs.

Overall, it provides registry and factory contracts that work in tandem to create instances related to the voting process, 
also exposing necessary functions for effective UI integration.

Currently, there are three main flows:
* Creation of the instance
* Registration process
* Voting process

## Pool creation

For the creation of a registration or vote, the user must be aware of the specific type of contract that is specified in 
the `Voting Registry` contract. This type and connected implementation is established by the “system owner” (hereinafter, 
any contract owner will be referred to as a “system owner” for simplicity) through the use of the `setNewImplementations` function. 

Currently, it is not possible to retrieve all possible types from the `Voting Registry` contract.
To determine which type to use, the user must either analyse the calls to the `Voting Registry` in the blockchain to find 
all types or simply refer to this document.

At the moment, two types are supported:
* Simple Registration
* Simple Voting

The user can find out the contract implementation address behind the type, which will be used as the proxy implementation 
parameter, by using the `getPoolImplementation` function in the `VotingRegistry` contract.

After the user has selected the type of contract to deploy, they can use the `Voting Factory` contract to create an instance of the registration or voting.

In the explanation below, our primary focus will be on the `createRegistration` function. After a detailed explanation, 
the differences in creating a voting instance will be mentioned at the end.

### Instance Deployment Preparation

There are two types of functions for contract deployment located inside the Voting Factory contract: `createRegistration` and `createRegistrationWithSalt`.
The only difference between them is that the second function allows the use of a salt parameter to deterministically deploy 
an instance via `create2`. Deterministic deployment means that the address of the future instance can be easily calculated 
using the `predictAddress` function before actual contract deployment.

The future contract address depends on the deployer address and the random salt parameter. Therefore, even if two different 
deployers use the same salt, the future instance address will differ, as the deployer addresses are different.

Knowing the future instance address can be useful for various reasons; the main purpose for using it here is to include 
the addresses of the instance in the remark field (the remark is one of the initialization parameters of the `Registration` and `Voting` contracts).

The next thing that the user may need to prepare is the `data` parameter. The `data` parameter is an encoded function call. 
Most of the time, it will be a function initializer, for example, `__Registration_init`, to initialise the proxy instance 
in the same transaction as the proxy deployment.

Currently, only two contract types are supported; therefore, only two possible ways of initialising contract parameters exist.

When a registration contract is deployed, it expects a `RegistrationParams` structure; parameters within this structure 
are described in the NatSpec documentation of the structure (see `IRegistration` interface).

Similarly, the same initialization function exists for the Voting contract: `__Voting_init`. To learn about possible 
initialization parameters, follow the NatSpec documentation of the `VotingParams` structure (see `IVoting` interface).

### Registration and Voting Coordination

Along with the `createRegistration` and `createRegistrationWithSalt` functions, two additional functions, `createVoting` and `createVotingWithSalt`, exist.

For scalability reasons, both functions require the type of the contract to be deployed. In the future, for instance, 
another type of registration contract could be added; hence, we could use the already existing `createRegistration` function 
to deploy new instances using a new type.

The only difference between the `createRegistration(withSalt)` and `createVoting(withSalt)` functions is the presence of a 
check within the `createVoting(withSalt)` function to ascertain if the instance adheres to the `IVotingPool` interface, 
and presence of a call to the `votingRegistry` to associate the newly deployed voting instance with the registration contract 
within the voting contract.

If a user calls the `createVoting(WithSalt)` function with the appropriate parameters, after its execution, it will be 
possible to use the `getVotingForRegistration` function to retrieve the voting address by providing a registration contract address from the `Voting Registry` contract.

It is possible, but not recommended, to deploy a voting instance through the `createRegistration` function. 
If a user does so, it will not be possible to use the `getVotingForRegistration` function to retrieve a voting contract 
for the registration contract. Everything else will work as expected.

### Instance deployment

After all preparations are completed, the user can simply call one of the create functions inside the `Voting Factory` contract to deploy the desired instance.

## Registration Process

When the `Registration` contract is created, users can call the `register` function, where they can prove their identity 
and register for the future voting process.

This process is described in detail and aligned with the [project's whitepaper](https://freedomtool.org/#/doc).

## Voting Process

Similar to the registration, the voting process is described in the [whitepaper](https://freedomtool.org/#/doc).

For more implementation details, please refer to the `IVoting` interface and the NatSpec documentation.

The probability of identifying the user's address during the registration that cast a specific vote is equal to 1/n, 
where n is the number of registered users.

## Integration

Also, for development needs, you can install the package from npm:

```console
$ npm install @rarimo/voting-contracts
```

## License

The library is released under the MIT License.
