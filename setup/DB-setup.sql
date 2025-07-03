CREATE TABLE public.participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT participants_pkey PRIMARY KEY (id),
  CONSTRAINT participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT participants_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id)
);
CREATE TABLE public.sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  is_active boolean DEFAULT true,
  CONSTRAINT sessions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  ticket_number character varying NOT NULL,
  title character varying NOT NULL,
  jira_link character varying NOT NULL,
  total_votes integer DEFAULT 0,
  median_value numeric DEFAULT 0,
  final_value numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tickets_pkey PRIMARY KEY (id),
  CONSTRAINT tickets_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  is_admin boolean DEFAULT false,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.votes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  value numeric,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT votes_pkey PRIMARY KEY (id),
  CONSTRAINT votes_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id)
);