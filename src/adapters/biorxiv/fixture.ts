export interface BiorxivFixtureOptions {
  existingAuthors?: number;
  dialogOpen?: boolean;
  saveCloses?: boolean;
  addRemountDelayMs?: number;
  addLabelAfterSave?: string;
  /** Render a Material icon ligature inside the Add control, as bioRxiv does. */
  addIconLigature?: string;
  /** Add a hidden decoy button whose text is exactly "Add Author". */
  hiddenDecoyAddButton?: boolean;
  /** Reopen the reused dialog still holding the previous author's values. */
  staleValuesOnReopen?: boolean;
  /** Clear the reused dialog asynchronously, as a reactive framework would. */
  resetDelayMs?: number;
  /** Commit the saved author to the table asynchronously, as a server would. */
  commitDelayMs?: number;
  /** Show bioRxiv's hash error when Add is clicked before the commit lands. */
  errorOnEarlyAdd?: boolean;
  /** Hidden import-preview data table rendered before the author list. */
  hiddenImportTable?: boolean;
  /** Render row actions as icon-only edit/delete controls, as bioRxiv does. */
  rowActionControls?: boolean;
  /** Wipe the dialog once after it opens, as a late framework re-render does. */
  lateResetMs?: number;
  /** Reject Save with field validation when the first name is empty. */
  validateOnSave?: boolean;
  /**
   * Clear the fields on the first Save, reproducing a portal whose model lost
   * the values even though the DOM still showed them.
   */
  wipeOnFirstSave?: boolean;
  /**
   * Look the author up when an email is entered and, after this delay, show a
   * "fetch author data" offer while clearing the other fields — bioRxiv's real
   * behaviour, which discards anything written during the lookup.
   */
  emailLookupMs?: number;
}

export interface BiorxivFixtureHarness {
  savedAuthors(): Array<{
    email: string;
    firstName: string;
    middleName: string;
    lastName: string;
    affiliation: string;
    corresponding: boolean;
  }>;
  addClicks(): number;
  saveClicks(): number;
  continueClicks(): number;
  /** Name fields written while an email lookup was still in flight. */
  namesWrittenDuringLookup(): number;
}

export function mountBiorxivFixture(
  options: BiorxivFixtureOptions = {},
): BiorxivFixtureHarness {
  const iconMarkup = options.addIconLigature
    ? `<i class="v-icon material-icons">${options.addIconLigature}</i>`
    : '';
  const decoyMarkup = options.hiddenDecoyAddButton
    ? `<div class="v-dialog" style="display: none">
         <button type="button" id="decoy-add-author">Add Author</button>
       </div>`
    : '';

  document.body.innerHTML = `
    <div id="submission_form">
      <div class="v-alert error--text" id="portal-error" style="display: none"></div>
      <div id="author-lookup" class="v-alert" role="alert" style="display: none">
        <i class="v-icon material-icons">check_circle</i>
        <span>Found author Example Person, Example Institute. Click to fetch author data. This will overwrite any existing fields.</span>
        <button type="button" id="fill-info">FILL INFO</button>
      </div>
      ${
        options.hiddenImportTable
          ? `<div class="v-dialog" style="display: none">
               <table class="v-datatable v-table theme--light" id="import-preview">
                 <thead><tr><th>Author</th><th>Email</th></tr></thead>
                 <tbody><tr><td colspan="2">No data available</td></tr></tbody>
               </table>
             </div>`
          : ''
      }
      ${decoyMarkup}
      <main class="v-content">
        <button type="button" class="v-btn theme--light primary" id="add-author">
          ${iconMarkup}Add Author
        </button>
        <table class="v-datatable v-table theme--light">
          <thead><tr><th>Author</th><th>Email</th></tr></thead>
          <tbody id="author-rows"></tbody>
        </table>
      </main>
      <div class="v-dialog__content">
        <div class="v-dialog" id="author-dialog">
          <div class="v-card">
            <div class="v-card__text">
              <label><input type="checkbox" id="consortium" /> Change to a Collaborative Group/Consortium</label>
              <label><input type="checkbox" id="corresponding" /> Mark as Corresponding Author</label>
              <div class="v-input"><label>Email</label><input type="text" id="email" /></div>
              <div class="v-input"><label>First Name</label><input type="text" name="firstName" /></div>
              <div class="v-input"><label>Middle Name(s)/Initial(s)</label><input type="text" id="middle-name" /></div>
              <div class="v-input"><label>Last Name</label><input type="text" name="lastName" /></div>
              <div class="v-input"><label>Institution</label><input type="text" name="affiliation" /></div>
            </div>
            <div class="v-messages__message" id="dialog-validation" style="display: none"></div>
            <div class="v-card__actions">
              <button type="button" class="v-btn primary" id="save-author">Save</button>
              <button type="button" class="v-btn" id="cancel-author">Cancel</button>
            </div>
          </div>
        </div>
      </div>
      <input type="submit" name="CA_continue" value="Save and Continue" />
    </div>
  `;

  const saved: ReturnType<BiorxivFixtureHarness['savedAuthors']> = [];
  for (let index = 0; index < (options.existingAuthors ?? 0); index += 1) {
    saved.push({
      email: `existing${index + 1}@example.org`,
      firstName: `Existing${index + 1}`,
      middleName: '',
      lastName: 'Author',
      affiliation: 'Existing Institute',
      corresponding: index === 0,
    });
  }

  const dialog = document.getElementById('author-dialog')!;
  const rows = document.getElementById('author-rows')!;
  const add = document.getElementById('add-author') as HTMLButtonElement;
  const save = document.getElementById('save-author') as HTMLButtonElement;
  const continueControl = document.querySelector(
    'input[name="CA_continue"]',
  ) as HTMLInputElement;
  let addClicks = 0;
  let saveClicks = 0;
  let continueClicks = 0;
  let commitPending = false;
  let lateResetDone = false;
  let wipedOnce = false;
  let lookupInFlight = false;
  let namesWrittenDuringLookup = 0;

  function renderRows() {
    const actions = options.rowActionControls
      ? `<td><button type="button"><i class="v-icon">edit</i></button>` +
        `<button type="button"><i class="v-icon">delete</i></button></td>`
      : '';
    rows.innerHTML =
      saved.length === 0
        ? '<tr><td colspan="2">No authors added</td></tr>'
        : saved
            .map(
              (author) =>
                `<tr>${actions}<td>${author.firstName} ${author.lastName}</td><td>${author.email}</td></tr>`,
            )
            .join('');
  }

  function setDialogOpen(open: boolean) {
    dialog.classList.toggle('v-dialog--active', open);
    dialog.style.display = open ? 'block' : 'none';
  }

  function resetDialog() {
    dialog.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
      if (input.type === 'checkbox') input.checked = false;
      else input.value = '';
    });
  }

  add.addEventListener('click', () => {
    addClicks += 1;
    if (options.errorOnEarlyAdd && commitPending) {
      const banner = document.getElementById('portal-error')!;
      banner.textContent = 'Author does not exists hash do not match';
      banner.style.display = 'block';
      return;
    }
    if (options.staleValuesOnReopen) {
      // Reused dialog keeps the previous author's values.
      setDialogOpen(true);
      return;
    }
    if (options.resetDelayMs !== undefined) {
      setDialogOpen(true);
      setTimeout(resetDialog, options.resetDelayMs);
      return;
    }
    resetDialog();
    setDialogOpen(true);
    if (options.lateResetMs !== undefined && !lateResetDone) {
      // One late re-render after Corresponding has already written values.
      setTimeout(() => {
        lateResetDone = true;
        resetDialog();
      }, options.lateResetMs);
    }
  });
  save.addEventListener('click', () => {
    saveClicks += 1;
    const validation = document.getElementById('dialog-validation')!;
    if (options.wipeOnFirstSave && !wipedOnce) {
      wipedOnce = true;
      resetDialog();
      validation.textContent = 'the first name field is required.';
      validation.style.display = 'block';
      return;
    }
    const firstNameValue = (
      document.querySelector('input[name="firstName"]') as HTMLInputElement
    ).value;
    if (options.validateOnSave && !firstNameValue.trim()) {
      validation.textContent = 'the first name field is required.';
      validation.style.display = 'block';
      return;
    }
    validation.style.display = 'none';
    validation.textContent = '';
    const record = {
      email: (document.getElementById('email') as HTMLInputElement).value,
      firstName: (
        document.querySelector('input[name="firstName"]') as HTMLInputElement
      ).value,
      middleName: (
        document.getElementById('middle-name') as HTMLInputElement
      ).value,
      lastName: (
        document.querySelector('input[name="lastName"]') as HTMLInputElement
      ).value,
      affiliation: (
        document.querySelector('input[name="affiliation"]') as HTMLInputElement
      ).value,
      corresponding: (
        document.getElementById('corresponding') as HTMLInputElement
      ).checked,
    };
    if (options.saveCloses !== false) setDialogOpen(false);
    if (options.addRemountDelayMs !== undefined) {
      add.style.display = 'none';
      setTimeout(() => {
        add.innerHTML = `${iconMarkup}${options.addLabelAfterSave ?? 'Add Author'}`;
        add.style.display = '';
      }, options.addRemountDelayMs);
    }

    const commit = () => {
      saved.push(record);
      commitPending = false;
      renderRows();
    };
    if (options.commitDelayMs !== undefined) {
      commitPending = true;
      setTimeout(commit, options.commitDelayMs);
    } else {
      commit();
    }
  });
  continueControl.addEventListener('click', (event) => {
    event.preventDefault();
    continueClicks += 1;
  });

  // Reactive frameworks clear a field's validation message once it is valid
  // again, which is how Corresponding can tell the value was accepted.
  const firstNameInput = document.querySelector(
    'input[name="firstName"]',
  ) as HTMLInputElement;
  const clearValidation = () => {
    if (!firstNameInput.value.trim()) return;
    const validation = document.getElementById('dialog-validation')!;
    validation.textContent = '';
    validation.style.display = 'none';
  };
  firstNameInput.addEventListener('input', clearValidation);
  firstNameInput.addEventListener('blur', clearValidation);

  if (options.emailLookupMs !== undefined) {
    const emailInput = document.getElementById('email') as HTMLInputElement;
    const lookupPanel = document.getElementById('author-lookup')!;
    let pending: ReturnType<typeof setTimeout> | undefined;

    for (const selector of [
      'input[name="firstName"]',
      'input[name="lastName"]',
      'input[name="affiliation"]',
    ]) {
      document.querySelector(selector)?.addEventListener('input', () => {
        if (lookupInFlight) namesWrittenDuringLookup += 1;
      });
    }

    emailInput.addEventListener('input', () => {
      if (!emailInput.value.trim()) return;
      if (pending) clearTimeout(pending);
      lookupInFlight = true;
      lookupPanel.style.display = 'none';
      pending = setTimeout(() => {
        lookupInFlight = false;
        // The lookup re-renders the dialog, discarding unrelated fields.
        for (const name of ['firstName', 'lastName', 'affiliation']) {
          const field = document.querySelector<HTMLInputElement>(
            `input[name="${name}"]`,
          );
          if (field) field.value = '';
        }
        (document.getElementById('middle-name') as HTMLInputElement).value = '';
        lookupPanel.style.display = 'block';
      }, options.emailLookupMs);
    });
  }

  renderRows();
  setDialogOpen(options.dialogOpen === true);

  return {
    savedAuthors: () => saved.map((author) => ({ ...author })),
    addClicks: () => addClicks,
    saveClicks: () => saveClicks,
    continueClicks: () => continueClicks,
    namesWrittenDuringLookup: () => namesWrittenDuringLookup,
  };
}
