const ecc = require('tiny-secp256k1')
const createhash = require('create-hash')
const randombytes = require('randombytes')
const bs58check = require('bs58check')
const { blake3 } = require('@noble/hashes/blake3');
// const { sha256 } = require('@noble/hashes/sha256');
var varint = require('varint');

function varint_encode(data) {
    return varint.encode(data)
}

function varint_decode(data) {
    return varint.decode(data)
}

function hash_blake3(data) {
    return blake3(data)
}

function hash_sha256(data) {
    return createhash('sha256').update(data).digest()
}

function base58check_encode(data) {
    return bs58check.encode(data);
}

function base58check_decode(data) {
    return bs58check.decode(data);
}

function generate_random_privkey() {
    let privkey;
    while(!ecc.isPrivate((privkey = randombytes(32))));
    return privkey;
}

function get_pubkey_from_privkey(privkey) {
    return ecc.pointFromScalar(privkey, true) // privkey, compressed
}

function deduce_address(pubkey, version) {
    var version = xbqcrypto.Buffer.from(xbqcrypto.varint_encode(version));
	return 'A' + base58check_encode(xbqcrypto.Buffer.concat([version, xbqcrypto.hash_blake3(pubkey)]));
}

function parse_address(address) {
    const pubkeyhash = base58check_decode(address.slice(1));
    if(pubkeyhash.length != 33)
        throw "Invalid address.";
    return {pubkeyhash: pubkeyhash.slice(1)};
}

function deduce_private_base58check(privkey) {
    return base58check_encode(privkey);
}

function parse_private_base58check(privb58c) {
    const privkey = base58check_decode(privb58c);
    return {privkey: privkey};
}

function deduce_public_base58check(pubkey) {
    return base58check_encode(pubkey);
}

function parse_public_base58check(pubb58c) {
    const pubkey = base58check_decode(pubb58c);
    if(pubkey.length != 32)
        throw "Invalid base58check public key.";
    return {pubkey: pubkey};
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

function compute_bytes_compact(fee, expire_period, sender_pubkey, type_id, recipient_address, amount) {
    var encoded_fee = Buffer.from(xbqcrypto.varint_encode(fee))
    var encoded_expire_periode = Buffer.from(xbqcrypto.varint_encode(expire_period))
    var encoded_type_id = Buffer.from(xbqcrypto.varint_encode(type_id))
    var encoded_amount = Buffer.from(xbqcrypto.varint_encode(amount))
    sender_pubkey = base58check_decode(sender_pubkey)
    recipient_address = base58check_decode(recipient_address.slice(1)).slice(1)
    return Buffer.concat([encoded_fee, encoded_expire_periode, sender_pubkey, encoded_type_id, recipient_address, encoded_amount])
}

module.exports = {
    varint_decode: varint_decode,
    varint_encode: varint_encode,
    hash_sha256: hash_sha256,
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
    hash_blake3: hash_blake3,
    compute_bytes_compact: compute_bytes_compact,
    Buffer: Buffer
}
