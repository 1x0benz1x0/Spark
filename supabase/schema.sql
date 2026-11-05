-- MCHS Chat schema (run in Supabase SQL editor)

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text,
  avatar_url text,
  bio text,
  created_at timestamptz default now()
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  image_url text not null,
  caption text,
  created_at timestamptz default now()
);

create table if not exists likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (post_id, user_id)
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

create table if not exists follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid references profiles(id) on delete cascade not null,
  following_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (follower_id, following_id)
);

-- RLS
alter table profiles enable row level security;
alter table posts enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;
alter table follows enable row level security;

create policy "profiles readable" on profiles for select using (true);
create policy "profiles insert own" on profiles for insert with check (auth.uid() = id);
create policy "profiles update own" on profiles for update using (auth.uid() = id);

create policy "posts readable" on posts for select using (true);
create policy "posts insert own" on posts for insert with check (auth.uid() = user_id);
create policy "posts delete own" on posts for delete using (auth.uid() = user_id);

create policy "likes readable" on likes for select using (true);
create policy "likes insert own" on likes for insert with check (auth.uid() = user_id);
create policy "likes delete own" on likes for delete using (auth.uid() = user_id);

create policy "comments readable" on comments for select using (true);
create policy "comments insert own" on comments for insert with check (auth.uid() = user_id);
create policy "comments delete own" on comments for delete using (auth.uid() = user_id);

create policy "follows readable" on follows for select using (true);
create policy "follows insert own" on follows for insert with check (auth.uid() = follower_id);
create policy "follows delete own" on follows for delete using (auth.uid() = follower_id);

-- auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- storage bucket policy (run after creating 'posts' bucket)
-- insert into storage.buckets (id, name, public) values ('posts','posts',true) on conflict do nothing;
create policy "posts bucket public read" on storage.objects for select using (bucket_id='posts');
create policy "posts bucket upload own" on storage.objects for insert with check (bucket_id='posts' and auth.role()='authenticated');
create policy "posts bucket delete own" on storage.objects for delete using (bucket_id='posts' and auth.uid()::text = (storage.foldername(name))[1]);
