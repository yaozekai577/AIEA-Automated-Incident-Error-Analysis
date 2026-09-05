package com.yzk.aiea.repository;

import com.yzk.aiea.entity.NotifyRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotifyRecordRepository extends JpaRepository<NotifyRecord, Long> {

    List<NotifyRecord> findByEventId(Long eventId);
}
