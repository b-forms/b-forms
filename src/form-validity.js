import { defaultInitialiser } from 'mutation-initialiser';


/**
 * Form Validation.
 *
 * @link https://developer.mozilla.org/en-US/docs/Learn/Forms/Form_validation
 * @link https://developer.mozilla.org/en-US/docs/Web/API/HTMLObjectElement/setCustomValidity
 */
export default class FormValidity {
  api;
  form;
  options;
  required = [];

  constructor(form, options = {}) {
    this.form = form;
    this.options = Object.assign({
      'headers': {}, // Additional HTTP headers for the validation API endpoint.
      'messageClass': 'validity-message', // The class of the invalid message.
      'fieldParam': 'field',
      'insertContainer': false, // Automatically try to insert a message container if one is not provided.
    }, options);

    const initialise = defaultInitialiser(form, {
        childList: true,
        subtree: true,
        many: true,
        attributes: true,
        watch: true,
    });
    initialise('[required]', this.initRequired.bind(this));

    if (form.hasAttribute('validation-api')) {
      this.api = form.getAttribute('validation-api');
      form.addEventListener('change', this.onChangeAPI.bind(this));
    } else {
      form.addEventListener('change', this.onChange.bind(this));
    }

    form.addEventListener('submit', this.onSubmit.bind(this));
    form.addEventListener('focusin', this.onFocus.bind(this));

    // Take over validation by setting novalidate.
    form.setAttribute('novalidate', '');
  }


  /**
   * Don't be too hasty.
   *
   * Do not show error messages for required fields until after the form is
   * submitted. It is rude.
   */
  initRequired(field) {
    this.required.push(field);
    field.removeAttribute('required');
  }

  checkRequired(field) {
    if (this.required.includes(field)) {
      field.setAttribute('required', '');
    }
  }

  onSubmit(e) {
    for (const field of this.form.elements) {
      this.checkRequired(field);
      if (!field.validity.valid) {
        this.showValidity(field);
        e.preventDefault();
      }
    }
  }

  onChange(e) {
    const field = e.target;
    this.checkRequired(field);

    if (!field.validity.valid) {
      this.showValidity(field);
      e.preventDefault();
    }
  }

  onChangeAPI(e) {
    const field = e.target;
    this.checkRequired(field);

    const url = new URL(this.api, window.location.origin);
    url.searchParams.append(this.options.fieldParam, field.name);

    let data = new FormData(this.form);
    for (const content of this.form.querySelectorAll('div[contenteditable]')) {
      data.append(content.dataset.name, content.textContent);
    }

    fetch(url, {
      headers: Object.assign({
        'Content-Type': 'application/json',
      }, this.options.headers),
      method: 'post',
      body: JSON.stringify(Object.fromEntries(data.entries())),
    })
      .then(response => {
        if (response.status !== 200) {
            throw new Error(`Received an HTTP response code ${response.status} from the validation API.`);
        }
        return response.json()
      })
      .then(json => {
        if (json.validity) {
          field.setCustomValidity(json.validity);
        } else {
          field.setCustomValidity('');
				}
        if (json.value) {
          field.value = json.value; // Formatting.
        }

        if (field.validity.valid) {
          this.clearValidity(field)
        } else {
          this.showValidity(field)
        }
      })
      .catch(error => {
        if ('error' in this.options) {
          this.options.error(error);
        } else {
          throw new e;
        }
      });
  }

  /**
   * Return the element that contains validation messages for a given field.
   */
  messageContainer(field) {
    let messageContainer = null;

    // Find the explicity defined message container.
    if (field.id) {
      for (const match of this.form.querySelectorAll('[validation-for]')) {
        if (match.getAttribute('validation-for') === field.id) {
          messageContainer = match;
        }
      }
    }

    // If not found, then create one (unless it is a radio button.)
    if (messageContainer === null && field.type !== 'radio' && this.options.insertContainer) {
      messageContainer = field.nextElementSibling;

      if (!messageContainer) {
        messageContainer = document.createElement('div');
        field.after(messageContainer);
      }
    }

    if (messageContainer !== null) {
      messageContainer.classList.add(this.options.messageClass);
      messageContainer.setAttribute('aria-live', 'polite');
    }

    return messageContainer;
  }

  /**
   * Clear the validation message.
   */
  clearValidity(field) {
    const messageContainer = this.messageContainer(field);
    if (messageContainer !== null) {
      messageContainer.textContent = '';
    }
  }

  /**
   * Show validation message.
   */
  showValidity(field) {
    const messageContainer = this.messageContainer(field);
    if (messageContainer !== null) {
      messageContainer.textContent = this.validityMessage(field);
    }
  }

  /**
   * Check each validity state flag on a form field and return an appropriate
   * validation message.
   *
   * https://developer.mozilla.org/en-US/docs/Web/API/ValidityState
   */
  validityMessage(field) {
    if (field.validity.customError) {
      return field.validationMessage;
    }
    if (field.validity.valueMissing) {
      return 'Missing required field.';
    }
    if (field.validity.typeMismatch) {
      if (field.type == 'email') {
        return 'Invalid email address.';
      }
      return `Invalid ${field.type}.`;
    }
    if (field.validity.tooShort) {
      return 'Too short.'
    }
    if (field.validity.tooLong) {
      return 'Too long.'
    }
    if (field.validity.rangeUnderflow) {
      return 'Range underflow.'
    }
    if (field.validity.rangeOverflow) {
      return 'Range overflow.'
    }
    if (field.validity.stepMismatch) {
      return 'Step mismatch.'
    }
    if (field.validity.patternMismatch) {
      return 'Pattern mismatch.'
    }
    if (field.validity.badInput) {
      return 'Bad input.';
    }
    if (!field.validity.valid) {
      return 'Invalid.'
    }
  }

  onFocus(e) {
  }
}
