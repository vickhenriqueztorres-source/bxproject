-- Check and Reserve Risk Lua Script (Teto de Solvência de 3% Float Cap)
-- KEYS[1]: broker:deposit_float_minor
-- KEYS[2]: risk:candle:{symbol}:{expiry_bucket}:{direction}
-- ARGV[1]: stake_minor
-- ARGV[2]: payout_percentage (e.g. 85)
-- ARGV[3]: ttl_seconds (e.g. 600)

local deposit_float = tonumber(redis.call('GET', KEYS[1]) or '0')
if deposit_float <= 0 then
  return {-1, 'ERR_NO_DEPOSIT_FLOAT'}
end

local max_risk_cap = math.floor(deposit_float * 0.03)
local stake_minor = tonumber(ARGV[1])
local payout_pct = tonumber(ARGV[2])
local additional_risk = math.floor(stake_minor * payout_pct / 100)

local current_exposure = tonumber(redis.call('GET', KEYS[2]) or '0')
if (current_exposure + additional_risk) > max_risk_cap then
  return {-2, 'ERR_RISK_CAP_EXCEEDED'}
end

local new_exposure = redis.call('INCRBY', KEYS[2], additional_risk)
redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3]))

return {1, 'APPROVED', new_exposure}
