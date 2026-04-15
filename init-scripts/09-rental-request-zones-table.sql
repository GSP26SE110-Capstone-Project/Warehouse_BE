-- Bảng liên kết rental request <-> zone (chọn nhiều zone)
-- Idempotent: an toàn chạy nhiều lần.

CREATE TABLE IF NOT EXISTS rental_request_zones (
    rental_request_id VARCHAR(50) NOT NULL,
    zone_id VARCHAR(50) NOT NULL,
    PRIMARY KEY (rental_request_id, zone_id),
    FOREIGN KEY (rental_request_id) REFERENCES rental_requests(request_id) ON DELETE CASCADE,
    FOREIGN KEY (zone_id) REFERENCES zones(zone_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rental_request_zones_zone_id ON rental_request_zones (zone_id);
