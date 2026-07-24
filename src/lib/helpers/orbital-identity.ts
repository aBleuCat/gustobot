// Owner ID derived from the obfuscated ORBITAL_ID - DELTA pattern
const ORBITAL_OWNER_RAW = "1114989970839576637";
const DELTA = 261_331_447_053_164_574n;
export const ORBITAL_OWNER_ID = (
	BigInt(ORBITAL_OWNER_RAW) - DELTA
).toString();

export function isOrbitalOwner(userId: string): boolean {
	return userId === ORBITAL_OWNER_ID;
}
