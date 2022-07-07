const bs58check = require('bs58check')
const base58 = require('bs58')
const { blake3 } = require('@noble/hashes/blake3');
const { utils, getPublicKey, sign, verify } = require("@noble/ed25519");
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

function get_pubkey(privkey) {
    return getPublicKey(privkey)
}

function base58check_encode(data) {
    return bs58check.encode(data);
}

function base58check_decode(data) {
    return bs58check.decode(data);
}

function base58_decode(data) {
    return base58.decode(data);
}

function generate_random_privkey() {
    privkey = utils.randomPrivateKey();
    return privkey;
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

function deduce_private_base58check(privkey, version) {
    var version = xbqcrypto.Buffer.from(xbqcrypto.varint_encode(version));
    return 'S' + base58check_encode(xbqcrypto.Buffer.concat([version, privkey]));
    // return base58check_encode(privkey);
}

function parse_private_base58check(privb58c) {
    const privkey = base58check_decode(privb58c.slice(1)).slice(1);
    return privkey;
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

function get_address_thread(address) {
    return parse_address(address).pubkeyhash.readUInt8(0) >> 3;
}

function compute_bytes_compact(fee, expire_period, type_id, recipient_address, amount) {
    var encoded_fee = Buffer.from(xbqcrypto.varint_encode(fee))
    var encoded_expire_periode = Buffer.from(xbqcrypto.varint_encode(expire_period))
    var encoded_type_id = Buffer.from(xbqcrypto.varint_encode(type_id))
    var encoded_amount = Buffer.from(xbqcrypto.varint_encode(amount))
    recipient_address = base58check_decode(recipient_address.slice(1)).slice(1)
    return Buffer.concat([encoded_fee, encoded_expire_periode, encoded_type_id, recipient_address, encoded_amount])
}

module.exports = {
    varint_decode: varint_decode,
    varint_encode: varint_encode,
    base58check_encode: base58check_encode,
    base58check_decode: base58check_decode,
    generate_random_privkey: generate_random_privkey,
    deduce_address: deduce_address,
    parse_address: parse_address,
    deduce_private_base58check: deduce_private_base58check,
    parse_private_base58check: parse_private_base58check,
    deduce_public_base58check: deduce_public_base58check,
    parse_public_base58check: parse_public_base58check,
    get_address_thread: get_address_thread,
    hash_blake3: hash_blake3,
    compute_bytes_compact: compute_bytes_compact,
    sign: sign,
    verify: verify,
    get_pubkey: get_pubkey,
    base58_decode: base58_decode,
    Buffer: Buffer
}
