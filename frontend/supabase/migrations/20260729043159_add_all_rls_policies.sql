/*
# Add RLS policies for all Johnson Road tables (Part 2)

Adds 4 CRUD policies (SELECT/INSERT/UPDATE/DELETE) to each of the 11 tables.
Tables were created in the previous migration with RLS enabled but no policies.
*/

-- ============ ORGANIZATIONS ============
DROP POLICY IF EXISTS "select_org_members" ON organizations;
CREATE POLICY "select_org_members" ON organizations FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organization_members WHERE organization_members.organization_id = organizations.id AND organization_members.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_org_owner" ON organizations;
CREATE POLICY "insert_org_owner" ON organizations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "update_org_owner" ON organizations;
CREATE POLICY "update_org_owner" ON organizations FOR UPDATE
  TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- ============ PROFILES ============
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============ ORGANIZATION MEMBERS ============
DROP POLICY IF EXISTS "select_org_member" ON organization_members;
CREATE POLICY "select_org_member" ON organization_members FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
      AND om2.user_id = auth.uid()
      AND om2.status = 'active'
    )
  );

DROP POLICY IF EXISTS "insert_org_member_admin" ON organization_members;
CREATE POLICY "insert_org_member_admin" ON organization_members FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
      AND om2.user_id = auth.uid()
      AND om2.role IN ('owner', 'admin')
      AND om2.status = 'active'
    )
  );

DROP POLICY IF EXISTS "update_org_member_admin" ON organization_members;
CREATE POLICY "update_org_member_admin" ON organization_members FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
      AND om2.user_id = auth.uid()
      AND om2.role IN ('owner', 'admin')
      AND om2.status = 'active'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
      AND om2.user_id = auth.uid()
      AND om2.role IN ('owner', 'admin')
      AND om2.status = 'active'
    )
  );

DROP POLICY IF EXISTS "delete_org_member_admin" ON organization_members;
CREATE POLICY "delete_org_member_admin" ON organization_members FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
      AND om2.user_id = auth.uid()
      AND om2.role IN ('owner', 'admin')
      AND om2.status = 'active'
    )
  );

-- ============ PROJECTS ============
DROP POLICY IF EXISTS "select_org_projects" ON projects;
CREATE POLICY "select_org_projects" ON projects FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = projects.organization_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "insert_org_projects" ON projects;
CREATE POLICY "insert_org_projects" ON projects FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = projects.organization_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "update_org_projects" ON projects;
CREATE POLICY "update_org_projects" ON projects FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = projects.organization_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = projects.organization_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "delete_org_projects" ON projects;
CREATE POLICY "delete_org_projects" ON projects FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = projects.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND om.status = 'active'
    )
  );

-- ============ VIDEOS ============
DROP POLICY IF EXISTS "select_org_videos" ON videos;
CREATE POLICY "select_org_videos" ON videos FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = videos.project_id AND om.user_id = auth.uid() AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "insert_org_videos" ON videos;
CREATE POLICY "insert_org_videos" ON videos FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = videos.project_id AND om.user_id = auth.uid() AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "update_org_videos" ON videos;
CREATE POLICY "update_org_videos" ON videos FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = videos.project_id AND om.user_id = auth.uid() AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "delete_org_videos" ON videos;
CREATE POLICY "delete_org_videos" ON videos FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = videos.project_id AND om.user_id = auth.uid() AND om.status = 'active'
    )
  );

-- ============ REPORTS ============
DROP POLICY IF EXISTS "select_org_reports" ON reports;
CREATE POLICY "select_org_reports" ON reports FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = reports.project_id AND om.user_id = auth.uid() AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "insert_org_reports" ON reports;
CREATE POLICY "insert_org_reports" ON reports FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = reports.project_id AND om.user_id = auth.uid() AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "delete_org_reports" ON reports;
CREATE POLICY "delete_org_reports" ON reports FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = reports.project_id AND om.user_id = auth.uid() AND om.status = 'active'
    )
  );

-- ============ PROCESSING JOBS ============
DROP POLICY IF EXISTS "select_org_jobs" ON processing_jobs;
CREATE POLICY "select_org_jobs" ON processing_jobs FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = processing_jobs.project_id AND om.user_id = auth.uid() AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "insert_org_jobs" ON processing_jobs;
CREATE POLICY "insert_org_jobs" ON processing_jobs FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = processing_jobs.project_id AND om.user_id = auth.uid() AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "update_org_jobs" ON processing_jobs;
CREATE POLICY "update_org_jobs" ON processing_jobs FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = processing_jobs.project_id AND om.user_id = auth.uid() AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "delete_org_jobs" ON processing_jobs;
CREATE POLICY "delete_org_jobs" ON processing_jobs FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = processing_jobs.project_id AND om.user_id = auth.uid() AND om.status = 'active'
    )
  );

-- ============ NOTIFICATIONS ============
DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ API KEYS ============
DROP POLICY IF EXISTS "select_org_api_keys" ON api_keys;
CREATE POLICY "select_org_api_keys" ON api_keys FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = api_keys.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "insert_org_api_keys" ON api_keys;
CREATE POLICY "insert_org_api_keys" ON api_keys FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = api_keys.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "delete_org_api_keys" ON api_keys;
CREATE POLICY "delete_org_api_keys" ON api_keys FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = api_keys.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND om.status = 'active'
    )
  );

-- ============ INVOICES ============
DROP POLICY IF EXISTS "select_org_invoices" ON invoices;
CREATE POLICY "select_org_invoices" ON invoices FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = invoices.organization_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

-- ============ USER SESSIONS ============
DROP POLICY IF EXISTS "select_own_sessions" ON user_sessions;
CREATE POLICY "select_own_sessions" ON user_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_sessions" ON user_sessions;
CREATE POLICY "insert_own_sessions" ON user_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_sessions" ON user_sessions;
CREATE POLICY "delete_own_sessions" ON user_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
