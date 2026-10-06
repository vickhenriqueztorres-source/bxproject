-- Release Risk Lua Script (Compensação em caso de falha da ordem)
-- KEYS[1]: risk:candle:{symbol}:{expiry_bucket}:{direction}
-- ARGV[1]: amount_to_release

local current_exposure = tonumber(redis.call('GET', KEYS[1]) or '0')
local amount_to_release = tonumber(ARGV[1])

if current_exposure > 0 and amount_to_release > 0 then
  local to_decr = math.min(current_exposure, amount_to_release)
  redis.call('DECRBY', KEYS[1], to_decr)
end

return 1
