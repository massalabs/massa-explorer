const ecc= require('tiny-secp256k1')
const createhash= require('create-hash')
const randombytes= require('randombytes')
const bs58check= require('bs58check')

function hash_sha256(data) {
    return createhash('sha256').update(data).digest()
}

function hash_rmd160(data) {
    return createhash('rmd160').update(data).digest()
}

function hash160(data) {
    return hash_rmd160(hash_sha256(data));
}

function base58check_encode(data) {
    return bs58check.encode(data);
}

function base58check_decode(data) {
    return bs58check.decode(data);
}

function generate_random_privkey() {
    let privkey;
    while(!ecc.isPrivate((privkey= randombytes(32))));
    return privkey;
}

function get_pubkey_from_privkey(privkey) {
    return ecc.pointFromScalar(privkey, true) // privkey, compressed
}

function deduce_address(pubkey, version) {
    return 'A' + base58check_encode(Buffer.concat([Buffer.from([version]), hash160(pubkey)]));
}

function parse_address(address) {
    if(address[0] != 'A')
        throw 'Invalid address.';
    const contents= base58check_decode(address.substring(1));
    const pubkeyhash= contents.slice(1);
    if(pubkeyhash.length != 20)
        throw "Invalid address.";
    return {pubkeyhash: pubkeyhash, version: contents.readUInt8(0)};
}

function deduce_private_base58check(privkey, version) {
    return 'PVK' + base58check_encode(Buffer.concat([Buffer.from([version]), privkey]));
}

function parse_private_base58check(privb58c) {
    if(!privb58c.startsWith('PVK'))
        throw 'Invalid private base58check.';
    const contents= base58check_decode(privb58c.substring(3));
    const privkey= contents.slice(1);
    if(!ecc.isPrivate(privkey))
        throw "Invalid base58check private key.";
    return {privkey: privkey, version: contents.readUInt8(0)};
}


function deduce_public_base58check(pubkey, version) {
    return 'PBK' + base58check_encode(Buffer.concat([Buffer.from([version]), pubkey]));
}

function parse_public_base58check(pubb58c) {
    if(!pubb58c.startsWith('PBK'))
        throw 'Invalid public base58check.';
    const contents= base58check_decode(pubb58c.substring(3));
    const pubkey= contents.slice(1);
    if(pubkey.length != 33)
        throw "Invalid base58check public key.";
    return {pubkey: pubkey, version: contents.readUInt8(0)};
}


function sign_data(data, privkey) {
    return ecc.sign(hash_sha256(data), privkey);
}

function verify_data_signature(data, signature, pubkey) {
    return ecc.verify(hash_sha256(data), pubkey, signature)
}

function get_address_thread(address) {
    return parse_address(address).pubkeyhash.readUInt8(0) >> 3;
}

function get_timestamp() {
    return Math.floor(Date.now() / 1000) - 1514764800;
}

module.exports = {
    hash_sha256: hash_sha256,
    hash_rmd160: hash_rmd160,
    hash160: hash160,
    base58check_encode: base58check_encode,
    base58check_decode: base58check_decode,
    generate_random_privkey: generate_random_privkey,
    get_pubkey_from_privkey: get_pubkey_from_privkey,
    deduce_address: deduce_address,
    parse_address: parse_address,
    deduce_private_base58check: deduce_private_base58check,
    parse_private_base58check: parse_private_base58check,
    deduce_public_base58check: deduce_public_base58check,
    parse_public_base58check: parse_public_base58check,
    sign_data: sign_data,
    verify_data_signature: verify_data_signature,
    get_address_thread: get_address_thread,
    get_timestamp: get_timestamp,
    Buffer: Buffer
}
